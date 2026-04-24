const sanitize = (obj) => {
  if (obj instanceof Object) {
    for (const key in obj) {
      if (/^\$/.test(key)) {
        delete obj[key];
      } else if (obj[key] instanceof Object) {
        sanitize(obj[key]);
      }
    }
  }
  return obj;
};

const sanitizeMiddleware = (req, res, next) => {
  sanitize(req.body);
  sanitize(req.query);
  sanitize(req.params);
  next();
};

module.exports = sanitizeMiddleware;
