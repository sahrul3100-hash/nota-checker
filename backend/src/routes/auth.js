const router = require("express").Router();
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

router.post("/login", async (req, res, next) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ message: "username & password wajib diisi" });
    }

    const admin = await prisma.admin.findUnique({ where: { username: String(username) } });
    if (!admin) return res.status(401).json({ message: "Username / password salah" });

    const ok = await bcrypt.compare(String(password), admin.password);
    if (!ok) return res.status(401).json({ message: "Username / password salah" });

    const token = jwt.sign(
      { sub: admin.id, username: admin.username },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    );

    res.json({ token });
  } catch (e) {
    next(e);
  }
});

module.exports = router;