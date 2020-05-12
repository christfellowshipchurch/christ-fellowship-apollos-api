import {
    Auth
} from '@apollosproject/data-connector-rock';

const {
    resolver: coreResolver,
    registerToken: coreRegisterToken,
    generateToken: coreGenerateToken,
    contextMiddleware: coreContextMiddleware
} = Auth

export const registerToken = coreRegisterToken;
export const generateToken = coreGenerateToken;
export const contextMiddleware = coreContextMiddleware;

export { default as dataSource } from './data-source';
export { default as resolver } from './resolver';
export { default as schema } from './schema';