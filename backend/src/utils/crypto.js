const crypto = require('crypto');
const bcryptjs = require('bcryptjs');

// Hashear contraseña
const hashPassword = async (password) => {
  const salt = await bcryptjs.genSalt(12);
  return bcryptjs.hash(password, salt);
};

// Comparar contraseña
const comparePassword = async (password, hash) => {
  return bcryptjs.compare(password, hash);
};

// Generar UUID
const generateUUID = () => {
  return crypto.randomUUID();
};

// Hashear token
const hashToken = (token) => {
  return crypto.createHash('sha256').update(token).digest('hex');
};

// Sanitizar datos sensibles
const sanitizeUser = (user) => {
  const { password_hash, ...sanitized } = user;
  return sanitized;
};

module.exports = {
  hashPassword,
  comparePassword,
  generateUUID,
  hashToken,
  sanitizeUser,
};
