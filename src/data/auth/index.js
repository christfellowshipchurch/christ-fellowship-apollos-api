import {
    Auth
} from '@apollosproject/data-connector-rock';

const {
    resolver: coreResolver,
    registerToken: coreRegisterToken,
    generateToken: coreGenerateToken,
    contextMiddleware: coreContextMiddleware
} = Auth

export const resolver = coreResolver;
export const registerToken = coreRegisterToken;
export const generateToken = coreGenerateToken;
export const contextMiddleware = coreContextMiddleware;

export { authSchema as schema } from '@apollosproject/data-schema';

export { default as dataSource } from './data-source';