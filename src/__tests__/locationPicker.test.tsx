// @vitest-environment jsdom
import {act, useState} from 'react';
import {createRoot, type Root} from 'react-dom/client';
import {I18nextProvider} from 'react-i18next';
import {afterEach, beforeAll, beforeEach, describe, expect, it, vi} from 'vitest';
import i18n, {changeLanguage, initI18n} from '@/lib/i18n';
import {LocationPicker, type LocationValue} from '@/components/location/LocationPicker';
import {setGazetteerForTests} from '@/lib/places/places';

// React 18 needs this flag for `act` outside a test renderer.
(globalThis as {IS_REACT_ACT_ENVIRONMENT?: boolean}).IS_REACT_ACT_ENVIRONMENT = true;

const governorates = [
  {id: 'di', ar: 'دمشق', en: 'Damascus', lat: 33.5, lon: 36.3},
  {id: 'hl', ar: 'حلب', en: 'Aleppo', lat: 36.2, lon: 37.16},
];
const places = [
  {ar: 'حلب', en: 'Aleppo', g: 'hl', lat: 36.2, lon: 37.16, k: 'c' as const, p: 2e6},
  {ar: 'الباب', en: 'Al-Bab', g: 'hl', lat: 36.37, lon: 37.51, k: 't' as const, p: 6e4},
  {ar: 'برزة', en: 'Barzeh', g: 'di', lat: 33.55, lon: 36.32, k: 'd' as const, p: 0},
];

let container: HTMLDivElement;
let root: Root;
let latest: LocationValue;

const Harness = ({initial}: {initial: LocationValue}) => {
  const [value, setValue] = useState(initial);
  latest = value;
  return <LocationPicker value={value} onChange={setValue} idPrefix="t" />;
};

const flush = async () => {
  // Let promises (gazetteer load, debounced searches) settle inside act.
  await act(async () => {
    await new Promise(resolve => setTimeout(resolve, 0));
  });
};

const mount = async (initial: LocationValue) => {
  await act(async () => {
    root.render(
      <I18nextProvider i18n={i18n}>
        <Harness initial={initial} />
      </I18nextProvider>,
    );
  });
  await flush();
};

const setNativeValue = (element: HTMLInputElement | HTMLSelectElement, value: string) => {
  const prototype = element instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(prototype, 'value')!.set!.call(element, value);
  element.dispatchEvent(new Event(element instanceof HTMLSelectElement ? 'change' : 'input', {bubbles: true}));
};

const byId = <T extends HTMLElement>(id: string) => container.querySelector<T>(`#${id}`)!;

beforeAll(async () => {
  await initI18n();
});

beforeEach(async () => {
  setGazetteerForTests({governorates, places});
  // Nominatim must never be hit for real; return nothing so local results are what we assert on.
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ok: true, json: async () => []}));
  await changeLanguage('ar');
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  setGazetteerForTests(null);
  vi.unstubAllGlobals();
});

describe('LocationPicker', () => {
  it('lists the governorates in Arabic', async () => {
    await mount({location: '', lat: '', long: ''});
    const options = Array.from(byId<HTMLSelectElement>('t-governorate').options).map(option => option.text);
    expect(options).toContain('حلب');
    expect(options).toContain('دمشق');
  });

  it('writes the governorate and its centre point when one is chosen', async () => {
    await mount({location: '', lat: '', long: ''});
    await act(async () => setNativeValue(byId<HTMLSelectElement>('t-governorate'), 'hl'));
    expect(latest.location).toBe('حلب');
    expect(latest.lat).toBe('36.2');
    expect(latest.long).toBe('37.16');
  });

  it('autocompletes a partial name inside the chosen governorate and stores its coordinates', async () => {
    await mount({location: '', lat: '', long: ''});
    await act(async () => setNativeValue(byId<HTMLSelectElement>('t-governorate'), 'hl'));

    await act(async () => setNativeValue(byId<HTMLInputElement>('t-area'), 'باب'));
    await flush();

    const option = container.querySelector<HTMLElement>('[role="option"]');
    expect(option?.textContent).toContain('الباب');
    // Barzeh is in Damascus, so a scoped search must not offer it.
    expect(container.textContent).not.toContain('برزة');

    await act(async () => option!.click());
    expect(latest.location).toBe('حلب – الباب');
    expect(latest.lat).toBe('36.37');
    expect(latest.long).toBe('37.51');
  });

  it("browses the chosen governorate's full city list on focus, before typing anything", async () => {
    await mount({location: '', lat: '', long: ''});
    await act(async () => setNativeValue(byId<HTMLSelectElement>('t-governorate'), 'hl'));

    const input = byId<HTMLInputElement>('t-area');
    await act(async () => input.focus());
    await flush();

    const names = Array.from(container.querySelectorAll('[role="option"]')).map(el => el.textContent);
    // The full list — same cities the mobile app's city picker shows for Aleppo — not just ones already typed.
    expect(names.some(name => name?.includes('حلب'))).toBe(true);
    expect(names.some(name => name?.includes('منبج'))).toBe(true);
    // The 9-row cap only applies to typed search; browsing must not be truncated the same way.
    expect(names.length).toBeGreaterThan(9);

    const manbij = Array.from(container.querySelectorAll<HTMLElement>('[role="option"]')).find(option =>
      option.textContent?.includes('منبج'),
    );
    await act(async () => manbij!.click());
    // Manbij has no entry in this test's tiny gazetteer fixture, so it falls back to Aleppo's centre.
    expect(latest.location).toBe('حلب – منبج');
    expect(latest.lat).toBe('36.2');
    expect(latest.long).toBe('37.16');
  });

  it('supports keyboard selection', async () => {
    await mount({location: '', lat: '', long: ''});
    const input = byId<HTMLInputElement>('t-area');
    await act(async () => setNativeValue(input, 'برز'));
    await flush();

    await act(async () => {
      input.dispatchEvent(new KeyboardEvent('keydown', {key: 'ArrowDown', bubbles: true}));
    });
    await act(async () => {
      input.dispatchEvent(new KeyboardEvent('keydown', {key: 'Enter', bubbles: true}));
    });
    expect(latest.location).toBe('دمشق – برزة');
  });

  it('adds an optional landmark to the stored string', async () => {
    await mount({location: 'دمشق – برزة', lat: '33.55', long: '36.32'});
    await act(async () => setNativeValue(byId<HTMLInputElement>('t-detail'), 'قرب الجامع'));
    expect(latest.location).toBe('دمشق – برزة – قرب الجامع');
    // Coordinates are untouched by typing a landmark.
    expect(latest.lat).toBe('33.55');
  });

  it('opens an existing listing with its parts filled in', async () => {
    await mount({location: 'حلب – الباب – قرب الجامع', lat: '', long: ''});
    expect(byId<HTMLSelectElement>('t-governorate').value).toBe('hl');
    expect(byId<HTMLInputElement>('t-area').value).toBe('الباب');
    expect(byId<HTMLInputElement>('t-detail').value).toBe('قرب الجامع');
  });

  it('keeps a legacy free-text location intact instead of dropping it', async () => {
    await mount({location: 'مارع, ناحية مارع, سوريا', lat: '', long: ''});
    expect(byId<HTMLInputElement>('t-detail').value).toContain('مارع');
    // Re-emitting (e.g. the user tweaks the landmark) must not lose the text.
    await act(async () => setNativeValue(byId<HTMLInputElement>('t-detail'), 'مارع – وسط البلدة'));
    expect(latest.location).toBe('مارع – وسط البلدة');
  });

  describe('OpenStreetMap search', () => {
    const typeArea = async (text: string) => {
      await act(async () => setNativeValue(byId<HTMLInputElement>('t-area'), text));
      await flush();
    };

    it('never calls Nominatim while the user is typing (its policy forbids search-as-you-type)', async () => {
      await mount({location: '', lat: '', long: ''});
      await typeArea('كفر حمرة');
      await new Promise(resolve => setTimeout(resolve, 700)); // longer than any debounce
      expect(fetch).not.toHaveBeenCalled();
    });

    it('offers an explicit "search the map" row, and queries only when it is chosen', async () => {
      (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        json: async () => [
          {osm_type: 'node', osm_id: 7, name: 'كفر حمرة', lat: '36.3', lon: '37.1', address: {state: 'محافظة حلب'}},
        ],
      });
      await mount({location: '', lat: '', long: ''});
      await typeArea('كفر حمرة');

      const more = container.querySelector<HTMLElement>('.place-combobox__more');
      expect(more?.textContent).toContain('كفر حمرة');
      expect(fetch).not.toHaveBeenCalled();

      await act(async () => more!.click());
      await flush();
      expect(fetch).toHaveBeenCalledTimes(1);
      const place = Array.from(container.querySelectorAll<HTMLElement>('[role="option"]')).find(option =>
        option.textContent?.includes('كفر حمرة') && !option.classList.contains('place-combobox__more'),
      );
      expect(place).toBeTruthy();

      await act(async () => place!.click());
      expect(latest.location).toBe('حلب – كفر حمرة');
      expect(latest.lat).toBe('36.3');
    });
  });
});
