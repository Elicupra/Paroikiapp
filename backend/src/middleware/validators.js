const { body, param, validationResult } = require('express-validator');

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Validation failed',
        details: errors.array().map(e => ({
          field: e.param,
          message: e.msg,
        })),
      },
    });
  }
  next();
};

// Validaciones para autenticación
const validateLogin = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Invalid email format'),
  body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters'),
  validate,
];

const validateRegister = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Invalid email format'),
  body('nombre_mostrado')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Name must be 2-100 characters'),
  body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters'),
  body('rol')
    .isIn(['monitor', 'organizador'])
    .withMessage('Invalid role'),
  validate,
];

const validateNewPassword = [
  body('currentPassword')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters'),
  body('newPassword')
    .isLength({ min: 8 })
    .withMessage('New password must be at least 8 characters'),
  validate,
];

const validateJoven = [
  body('nombre')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Name must be 2-100 characters'),
  body('apellidos')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Last names must be 2-100 characters'),
  validate,
];

const validatePago = [
  body('joven_id')
    .matches(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/, 'i')
    .withMessage('Invalid joven ID'),
  body('plazo_numero')
    .isInt({ min: 1 })
    .withMessage('Invalid installment number'),
  body('cantidad')
    .isDecimal({ decimal_digits: '1,2' })
    .custom(val => parseFloat(val) > 0)
    .withMessage('Amount must be greater than 0'),
  validate,
];

module.exports = {
  validate,
  validateLogin,
  validateRegister,
  validateNewPassword,
  validateJoven,
  validatePago,
};
