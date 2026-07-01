export function ok(value) {
    return {
        ok: true,
        value,
    };
}
export function err(code, message, cause) {
    return {
        ok: false,
        error: {
            code,
            message,
            cause,
        },
    };
}
