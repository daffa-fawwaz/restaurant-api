export const success = (res, status, message, data, meta) => {
    return res.status(status).json({
        success: true,
        status,
        message,
        data,
        meta,
        timestamp: new Date().toISOString(),
    });
};
export const error = (res, status, message, errType, errors) => {
    return res.status(status).json({
        success: false,
        status,
        message,
        error: errType,
        errors,
        timestamp: new Date().toISOString(),
    });
};
