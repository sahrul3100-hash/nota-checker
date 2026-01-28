import { BrowserRouter, Routes, Route, Link, Navigate } from "react-router-dom";
import Dashboard from "./pages/Dashboard.jsx";
import Check from "./pages/Check.jsx";
import Login from "./pages/Login.jsx";
import { Container, Nav } from "react-bootstrap";

function RequireAuth({ children }) {
  const token = localStorage.getItem("token");
  if (!token) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  const token = localStorage.getItem("token");

  function logout() {
    localStorage.removeItem("token");
    window.location.href = "/login";
  }

  return (
    <BrowserRouter>
      <Container className="py-3" style={{ maxWidth: 980 }}>
        <Nav className="gap-3 mb-3">
          <Nav.Item><Link to="/check">Cek Nota</Link></Nav.Item>
          {token ? (
            <>
              <Nav.Item><Link to="/">Dashboard</Link></Nav.Item>
              <Nav.Item><button onClick={logout}>Logout</button></Nav.Item>
            </>
          ) : (
            <Nav.Item><Link to="/login">Login</Link></Nav.Item>
          )}
        </Nav>
      </Container>

      <Routes>
        <Route path="/check" element={<Check />} />
        <Route path="/login" element={<Login />} />
        <Route
          path="/"
          element={
            <RequireAuth>
              <Dashboard />
            </RequireAuth>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}