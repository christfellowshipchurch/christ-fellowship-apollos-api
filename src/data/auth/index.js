import { get } from 'lodash';
import { registerToken } from './token';

export { registerToken, generateToken } from './token';
export { default as schema } from './schema';
export { default as dataSource } from './data-source';
export { default as resolver } from './resolver';

export const contextMiddleware = ({ req, context: ctx }) => {
    if (get(req, 'headers.authorization')) {
        const { userToken, rockCookie, sessionId } = registerToken(
            req.headers.authorization
        );
        if (sessionId) {
            return {
                ...ctx,
                userToken,
                rockCookie,
                sessionId,
            };
        }
    }
    return ctx;
};
