import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import IntakePage from './pages/IntakePage';
import ReviewPage from './pages/ReviewPage';
import ReportPage from './pages/ReportPage';
import PaymentSuccessPage from './pages/PaymentSuccessPage';
import PaymentCancelPage from './pages/PaymentCancelPage';
import HowItWorksPage from './pages/HowItWorksPage';
import FAQPage from './pages/FAQPage';
import AccessReportPage from './pages/AccessReportPage';
import DisclaimersPage from './pages/DisclaimersPage';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/intake" element={<IntakePage />} />
        <Route path="/review/:caseId" element={<ReviewPage />} />
        <Route path="/action-plan/:caseId" element={<ReportPage />} />
        <Route path="/payment/success" element={<PaymentSuccessPage />} />
        <Route path="/payment/cancel" element={<PaymentCancelPage />} />
        <Route path="/how-it-works" element={<HowItWorksPage />} />
        <Route path="/faq" element={<FAQPage />} />
        <Route path="/access-report" element={<AccessReportPage />} />
        <Route path="/disclaimers" element={<DisclaimersPage />} />
      </Routes>
    </Router>
  );
}

export default App;
