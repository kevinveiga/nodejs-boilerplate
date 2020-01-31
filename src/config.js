import path from 'path';

export const config = { path: { public: path.join(__dirname, '/../public') }, port: process.env.PORT || 3000 };
