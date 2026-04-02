const validator = require("validator");

const validateUserCredential = (req, res, next) => {
  const { email, password } = req.body;
  const errors = {};

  if (!email || validator.isEmpty(email)) {
    errors.email = "Email is required";
  } else if (!validator.isEmail(email)) {
    errors.email = "Invalid email format";
  }

  if (!password || validator.isEmpty(password)) {
    errors.password = "Password is required";
  } else if (!validator.isLength(password, { min: 8 })) {
    errors.password = "Password must be at least 8 characters long";
  }

  if (Object.keys(errors).length > 0) {
    return res.status(400).json({ success: false, errors });
  }

  next();
};

module.exports = validateUserCredential;