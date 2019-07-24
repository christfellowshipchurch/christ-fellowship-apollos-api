import { AuthenticationError } from 'apollo-server';
import jwt from 'jsonwebtoken';

export const secret = process.env.SECRET || 'ASea$2gadj#asd0';

export const parseToken = (token) => jwt.verify(token, secret);

export const registerToken = (token) => {
    console.log({ token });

    try {
        const { cookie, sessionId } = parseToken(token);

        return {
            userToken: token,
            rockCookie: cookie,
            sessionId,
        };
    } catch (e) {
        console.log({ e });
        throw new AuthenticationError('Invalid token');
    }
};

export const generateToken = (params) =>
    jwt.sign({ ...params }, secret, { expiresIn: '60d' });
