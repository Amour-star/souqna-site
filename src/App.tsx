import {Suspense, lazy, useEffect} from 'react';
import {Navigate, Route, Routes, useLocation} from 'react-router-dom';
import {useTranslation} from 'react-i18next';
import {Header} from '@/components/layout/Header';
import {BottomNav} from '@/components/layout/BottomNav';
import {Footer} from '@/components/layout/Footer';
import {LoadingState} from '@/components/ui';
import {RequireAuth} from '@/components/layout/RequireAuth';

// Route-level code splitting keeps the first paint small; the home and search
// routes are the common entry points and load eagerly with the shell.
const HomePage = lazy(() => import('@/pages/HomePage'));
const SearchPage = lazy(() => import('@/pages/SearchPage'));
const CategoryPage = lazy(() => import('@/pages/CategoryPage'));
const ListingPage = lazy(() => import('@/pages/ListingPage'));
const SellPage = lazy(() => import('@/pages/SellPage'));
const FavoritesPage = lazy(() => import('@/pages/FavoritesPage'));
const MessagesPage = lazy(() => import('@/pages/MessagesPage'));
const NotificationsPage = lazy(() => import('@/pages/NotificationsPage'));
const ProfilePage = lazy(() => import('@/pages/ProfilePage'));
const MyListingsPage = lazy(() => import('@/pages/MyListingsPage'));
const SettingsPage = lazy(() => import('@/pages/SettingsPage'));
const SellerProfilePage = lazy(() => import('@/pages/SellerProfilePage'));
const LoginPage = lazy(() => import('@/pages/LoginPage'));
const RegisterPage = lazy(() => import('@/pages/RegisterPage'));
const VerifyOtpPage = lazy(() => import('@/pages/VerifyOtpPage'));
const ForgotPasswordPage = lazy(() => import('@/pages/ForgotPasswordPage'));
const ResetPasswordPage = lazy(() => import('@/pages/ResetPasswordPage'));
const LogoutPage = lazy(() => import('@/pages/LogoutPage'));
const NotFoundPage = lazy(() => import('@/pages/NotFoundPage'));

/** Restores the top of the page on navigation, as a document-style site would. */
const ScrollToTop = () => {
  const {pathname} = useLocation();
  useEffect(() => {
    window.scrollTo({top: 0, behavior: 'auto'});
  }, [pathname]);
  return null;
};

/**
 * The previous single-page site used hash anchors (`/#privacy`) that are
 * linked from the app stores. Redirect those to the standalone documents so
 * external links keep working.
 */
const LEGACY_HASH_ROUTES: Record<string, string> = {
  '#privacy': '/privacy.html',
  '#terms': '/terms.html',
  '#contact': '/support.html',
  '#support': '/support.html',
};

const LegacyHashRedirect = () => {
  const {hash} = useLocation();
  useEffect(() => {
    const target = LEGACY_HASH_ROUTES[hash];
    if (target) window.location.replace(target);
  }, [hash]);
  return null;
};

export const App = () => {
  const {t} = useTranslation();

  return (
    <>
      <a className="skip-link" href="#main">
        {t('nav.skipToContent')}
      </a>
      <ScrollToTop />
      <LegacyHashRedirect />
      <Header />

      <main id="main">
        <Suspense fallback={<LoadingState />}>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/search" element={<SearchPage />} />
            <Route path="/category/:categoryId" element={<CategoryPage />} />
            <Route path="/category/:categoryId/:subCategoryId" element={<CategoryPage />} />
            <Route path="/listing/:slug" element={<ListingPage />} />
            <Route path="/seller/:sellerId" element={<SellerProfilePage />} />

            <Route
              path="/sell"
              element={
                <RequireAuth>
                  <SellPage />
                </RequireAuth>
              }
            />
            <Route
              path="/sell/:listingId"
              element={
                <RequireAuth>
                  <SellPage />
                </RequireAuth>
              }
            />
            <Route
              path="/favorites"
              element={
                <RequireAuth>
                  <FavoritesPage />
                </RequireAuth>
              }
            />
            <Route
              path="/messages"
              element={
                <RequireAuth>
                  <MessagesPage />
                </RequireAuth>
              }
            />
            <Route
              path="/messages/:conversationId"
              element={
                <RequireAuth>
                  <MessagesPage />
                </RequireAuth>
              }
            />
            <Route
              path="/notifications"
              element={
                <RequireAuth>
                  <NotificationsPage />
                </RequireAuth>
              }
            />
            <Route
              path="/profile"
              element={
                <RequireAuth>
                  <ProfilePage />
                </RequireAuth>
              }
            />
            <Route
              path="/profile/listings"
              element={
                <RequireAuth>
                  <MyListingsPage />
                </RequireAuth>
              }
            />
            <Route
              path="/profile/settings"
              element={
                <RequireAuth>
                  <SettingsPage />
                </RequireAuth>
              }
            />

            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/verify" element={<VerifyOtpPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />
            <Route path="/logout" element={<LogoutPage />} />

            {/* Legacy paths from the previous site */}
            <Route path="/index.html" element={<Navigate to="/" replace />} />

            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </Suspense>
      </main>

      <Footer />
      <BottomNav />
    </>
  );
};
