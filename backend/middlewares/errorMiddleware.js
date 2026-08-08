import logger from '../utils/logger.js';

export const notFound = (req, res, next) => {
  const error = new Error(`Not Found - ${req.originalUrl}`);
  res.status(404);
  next(error);
};

export const errorHandler = (err, req, res, next) => {
  let statusCode = res.statusCode === 200 ? 500 : res.statusCode;
  let message = err.message;

  // Handle Mongoose CastError (invalid ObjectId)
  if (err.name === 'CastError' && err.kind === 'ObjectId') {
    statusCode = 404;
    message = 'Resource not found';
  }

  // Handle Zod Validation Errors
  if (err.name === 'ZodError') {
    statusCode = 400;
    message = err.errors.map(e => e.message).join(', ');
  }

  // Log error (use warn for client auth expirations to keep server logs clean)
  if (statusCode === 401) {
    logger.warn(`${err.message} - ${req.originalUrl} - ${req.method} - ${req.ip}`);
  } else {
    logger.error(`${err.message} - ${req.originalUrl} - ${req.method} - ${req.ip}`);
  }

  res.status(statusCode).json({
    message,
    stack: process.env.NODE_ENV === 'production' ? null : err.stack,
  });
};
