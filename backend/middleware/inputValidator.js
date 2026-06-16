const { body, validationResult } = require('express-validator');
const xss = require('xss');

/**
 * Middleware to check validation results and return errors
 */
function handleValidationErrors(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Validation failed',
      details: errors.array().map(e => ({ field: e.path, message: e.msg }))
    });
  }
  next();
}

/**
 * Password strength validation rules
 * Requires: 8+ chars, 1 uppercase, 1 lowercase, 1 digit, 1 special character
 */
const passwordRules = body('password')
  .isLength({ min: 8 })
  .withMessage('Password must be at least 8 characters long.')
  .matches(/[A-Z]/)
  .withMessage('Password must contain at least one uppercase letter.')
  .matches(/[a-z]/)
  .withMessage('Password must contain at least one lowercase letter.')
  .matches(/[0-9]/)
  .withMessage('Password must contain at least one digit.')
  .matches(/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/)
  .withMessage('Password must contain at least one special character (!@#$%^&*...).');

/**
 * Validators for registration
 */
const validateRegister = [
  body('name')
    .trim()
    .notEmpty().withMessage('Name is required.')
    .isLength({ min: 2, max: 100 }).withMessage('Name must be between 2 and 100 characters.')
    .customSanitizer(value => xss(value)),
  body('email')
    .trim()
    .notEmpty().withMessage('Email is required.')
    .isEmail().withMessage('Please provide a valid email address.')
    .normalizeEmail(),
  passwordRules,
  body('role')
    .optional()
    .isIn(['client', 'editor', 'vfx_artist', 'pm', 'admin'])
    .withMessage('Invalid role. Must be: client, editor, vfx_artist, pm, or admin.'),
  handleValidationErrors
];

/**
 * Validators for login
 */
const validateLogin = [
  body('email')
    .trim()
    .notEmpty().withMessage('Email is required.')
    .isEmail().withMessage('Please provide a valid email address.')
    .normalizeEmail(),
  body('password')
    .notEmpty().withMessage('Password is required.'),
  handleValidationErrors
];

/**
 * Validators for project creation
 */
const validateProjectCreate = [
  body('name')
    .trim()
    .notEmpty().withMessage('Project name is required.')
    .isLength({ min: 1, max: 200 }).withMessage('Project name must be between 1 and 200 characters.')
    .customSanitizer(value => xss(value)),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 2000 }).withMessage('Description must be under 2000 characters.')
    .customSanitizer(value => xss(value)),
  body('client_name')
    .optional()
    .trim()
    .isLength({ max: 200 }).withMessage('Client name must be under 200 characters.')
    .customSanitizer(value => xss(value)),
  body('deadline')
    .optional()
    .isISO8601().withMessage('Deadline must be a valid date format.'),
  handleValidationErrors
];

/**
 * Validators for project update
 */
const validateProjectUpdate = [
  body('name')
    .optional()
    .trim()
    .notEmpty().withMessage('Project name cannot be empty.')
    .isLength({ min: 1, max: 200 }).withMessage('Project name must be between 1 and 200 characters.')
    .customSanitizer(value => xss(value)),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 2000 }).withMessage('Description must be under 2000 characters.')
    .customSanitizer(value => xss(value)),
  body('client_name')
    .optional()
    .trim()
    .isLength({ max: 200 }).withMessage('Client name must be under 200 characters.')
    .customSanitizer(value => xss(value)),
  body('deadline')
    .optional()
    .isISO8601().withMessage('Deadline must be a valid date format.'),
  handleValidationErrors
];

/**
 * Validators for task creation
 */
const validateTaskCreate = [
  body('title')
    .trim()
    .notEmpty().withMessage('Task title is required.')
    .isLength({ min: 1, max: 300 }).withMessage('Task title must be between 1 and 300 characters.')
    .customSanitizer(value => xss(value)),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 5000 }).withMessage('Task description must be under 5000 characters.')
    .customSanitizer(value => xss(value)),
  body('status')
    .optional()
    .isIn(['new', 'assigned', 'in_progress', 'review', 'completed'])
    .withMessage('Invalid task status.'),
  body('priority')
    .optional()
    .isIn(['low', 'medium', 'high', 'critical'])
    .withMessage('Invalid priority level.'),
  handleValidationErrors
];

/**
 * Validators for task update
 */
const validateTaskUpdate = [
  body('title')
    .optional()
    .trim()
    .notEmpty().withMessage('Task title cannot be empty.')
    .isLength({ min: 1, max: 300 }).withMessage('Task title must be between 1 and 300 characters.')
    .customSanitizer(value => xss(value)),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 5000 }).withMessage('Task description must be under 5000 characters.')
    .customSanitizer(value => xss(value)),
  body('status')
    .optional()
    .isIn(['new', 'assigned', 'in_progress', 'review', 'completed'])
    .withMessage('Invalid task status.'),
  body('priority')
    .optional()
    .isIn(['low', 'medium', 'high', 'critical'])
    .withMessage('Invalid priority level.'),
  handleValidationErrors
];

/**
 * Validators for feedback/comment submission
 */
const validateFeedback = [
  body('comment')
    .optional()
    .trim()
    .isLength({ max: 10000 }).withMessage('Comment must be under 10000 characters.')
    .customSanitizer(value => xss(value)),
  body('timestamp')
    .optional()
    .isFloat({ min: 0 }).withMessage('Timestamp must be a positive number.'),
  body('priority')
    .optional()
    .isIn(['low', 'medium', 'high', 'critical'])
    .withMessage('Invalid priority level.'),
  handleValidationErrors
];

/**
 * Generic text sanitizer middleware — sanitizes all string fields in req.body
 */
function sanitizeAllStrings(req, res, next) {
  if (req.body && typeof req.body === 'object') {
    for (const key of Object.keys(req.body)) {
      if (typeof req.body[key] === 'string') {
        req.body[key] = xss(req.body[key]);
      }
    }
  }
  next();
}

module.exports = {
  validateRegister,
  validateLogin,
  validateProjectCreate,
  validateProjectUpdate,
  validateTaskCreate,
  validateTaskUpdate,
  validateFeedback,
  sanitizeAllStrings,
  handleValidationErrors
};
