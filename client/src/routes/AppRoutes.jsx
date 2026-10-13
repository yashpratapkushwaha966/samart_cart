import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import ProtectedRoute from '../components/ProtectedRoute.jsx';
import PanelLogin from '../components/PanelLogin.jsx';
import { PageLoader } from '../components/ui.jsx';
import CustomerLayout from '../layouts/CustomerLayout.jsx';
import StaffLayout from '../layouts/StaffLayout.jsx';
import AdminLayout from '../layouts/AdminLayout.jsx';
import Home from '../pages/customer/Home.jsx';
import Menu from '../pages/customer/Menu.jsx';
import Cart from '../pages/customer/Cart.jsx';
import Login from '../pages/customer/Login.jsx';
import QrEntry from '../pages/customer/QrEntry.jsx';

// Staff and admin screens are loaded only when needed, so customers on slow phones download less.
const Checkout = lazy(() => import('../pages/customer/Checkout.jsx'));
const OrderPage = lazy(() => import('../pages/customer/OrderPage.jsx'));
const Orders = lazy(() => import('../pages/customer/Orders.jsx'));
const Account = lazy(() => import('../pages/customer/Account.jsx'));
const EditProfile = lazy(() => import('../pages/customer/EditProfile.jsx'));
const AdminFeedback = lazy(() => import('../pages/admin/Feedback.jsx'));
const StaffQueue = lazy(() => import('../pages/staff/Queue.jsx'));
const Dashboard = lazy(() => import('../pages/admin/Dashboard.jsx'));
const AdminOrders = lazy(() => import('../pages/admin/Orders.jsx'));
const Products = lazy(() => import('../pages/admin/Products.jsx'));
const Offers = lazy(() => import('../pages/admin/Offers.jsx'));
const Reports = lazy(() => import('../pages/admin/Reports.jsx'));
const Customers = lazy(() => import('../pages/admin/Customers.jsx'));
const Team = lazy(() => import('../pages/admin/Team.jsx'));
const Settings = lazy(() => import('../pages/admin/Settings.jsx'));
const Activity = lazy(() => import('../pages/admin/Activity.jsx'));

export default function AppRoutes() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        {/* Customer panel */}
        <Route element={<CustomerLayout />}>
          <Route index element={<Home />} />
          <Route path="menu" element={<Menu />} />
          <Route path="cart" element={<Cart />} />
          <Route path="login" element={<Login />} />
          <Route element={<ProtectedRoute role="customer" loginPath="/login" />}>
            <Route path="checkout" element={<Checkout />} />
            <Route path="order/:id" element={<OrderPage />} />
            <Route path="orders" element={<Orders />} />
            <Route path="account" element={<Account />} />
            <Route path="account/edit" element={<EditProfile />} />
          </Route>
        </Route>
        <Route path="profile" element={<Navigate to="/account" replace />} />
        <Route path="c/:slug" element={<QrEntry />} />

        {/* Cart staff panel */}
        <Route path="staff/login" element={<PanelLogin role="staff" title="Cart Staff" home="/staff" />} />
        <Route path="staff" element={<ProtectedRoute role="staff" loginPath="/staff/login" />}>
          <Route element={<StaffLayout />}><Route index element={<StaffQueue />} /></Route>
        </Route>

        {/* Admin panel */}
        <Route path="admin/login" element={<PanelLogin role="admin" title="Owner Login" home="/admin" />} />
        <Route path="admin" element={<ProtectedRoute role="admin" loginPath="/admin/login" />}>
          <Route element={<AdminLayout />}>
            <Route index element={<Dashboard />} />
            <Route path="orders" element={<AdminOrders />} />
            <Route path="menu" element={<Products />} />
            <Route path="offers" element={<Offers />} />
            <Route path="reports" element={<Reports />} />
            <Route path="customers" element={<Customers />} />
            <Route path="feedback" element={<AdminFeedback />} />
            <Route path="team" element={<Team />} />
            <Route path="settings" element={<Settings />} />
            <Route path="activity" element={<Activity />} />
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
