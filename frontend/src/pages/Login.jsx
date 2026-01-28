import { useState } from "react";
import axios from "axios";
import { Container, Card, Form, Button } from "react-bootstrap";
import { useNavigate } from "react-router-dom";

export default function Login() {
  const nav = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  async function onSubmit(e) {
    e.preventDefault();
    try {
      const res = await axios.post("/api/auth/login", { username, password });
      localStorage.setItem("token", res.data.token);
      nav("/");
    } catch (err) {
      alert(err?.response?.data?.message || "Login gagal");
    }
  }

  return (
    <Container className="py-4" style={{ maxWidth: 520 }}>
      <h3 className="mb-3">Login Admin</h3>
      <Card className="p-3">
        <Form onSubmit={onSubmit}>
          <Form.Control
            className="mb-2"
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />
          <Form.Control
            className="mb-3"
            placeholder="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <Button type="submit">Login</Button>
        </Form>
      </Card>
    </Container>
  );
}