import { createHash } from 'node:crypto';
import path from 'node:path';
import type { NextConfig } from 'next';

type WebpackRule = {
  oneOf?: unknown[];
  use?: unknown;
};

type WebpackLoader = {
  loader?: unknown;
  options?: {
    modules?: unknown;
  };
};

type CssModulesOptions = {
  getLocalIdent?: typeof getLocalIdent;
};

function getLocalIdent(
  context: { resourcePath: string },
  _localIdentName: string,
  className: string,
) {
  const componentName = path.basename(context.resourcePath).replace(/\.module\.scss$/, '');
  const hash = createHash('sha1')
    .update(`${context.resourcePath}:${className}`)
    .digest('hex')
    .slice(0, 3);

  return `${componentName}_${className}_${hash}`;
}

const nextConfig: NextConfig = {
  reactStrictMode: true,
  webpack(config) {
    const rules = config.module.rules.flatMap(rule => {
      const webpackRule = rule as WebpackRule;
      return Array.isArray(webpackRule.oneOf) ? webpackRule.oneOf : [webpackRule];
    });

    for (const rule of rules) {
      const webpackRule = rule as WebpackRule;
      const loaders = Array.isArray(webpackRule.use) ? webpackRule.use : [webpackRule.use];

      for (const loader of loaders) {
        const webpackLoader = loader as WebpackLoader;
        const modules = webpackLoader?.options?.modules;

        if (
          typeof webpackLoader?.loader !== 'string' ||
          !webpackLoader.loader.includes('css-loader') ||
          !modules ||
          typeof modules !== 'object'
        ) {
          continue;
        }

        (modules as CssModulesOptions).getLocalIdent = getLocalIdent;
      }
    }

    return config;
  },
};

export default nextConfig;
