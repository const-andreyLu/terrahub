'use strict';

const fs = require('fs');
const path = require('path');
const glob = require('glob');
const yaml = require('js-yaml');
const { toMd5, extend } = require('./helpers/util');
const { templates, config } = require('./parameters');

class ConfigLoader {
  /**
   * Constructor
   */
  constructor() {
    this._config = {};
    this._rootPath = false;
    this._rootConfig = {};
    this._projectConfig = {};

    /**
     * Initialisation
     */
    this._readRoot();
  }

  /**
   * Component default config
   * @returns {Object}
   * @private
   */
  _defaults() {
    const hooks = templates.hooks;

    return {
      app: this.appPath(),
      parent: null,
      children: [],
      hooks: {
        plan: {
          before: path.join(hooks, 'plan', 'before.js'),
          after: path.join(hooks, 'plan', 'after.js')
        },
        apply: {
          before: path.join(hooks, 'apply', 'before.js'),
          after: path.join(hooks, 'apply', 'after.js')
        },
        destroy: {
          before: path.join(hooks, 'destroy', 'before.js'),
          after: path.join(hooks, 'destroy', 'after.js')
        }
      }
    };
  }

  /**
   * Read root config
   * @private
   */
  _readRoot() {
    const [configFile] = this._find('.terrahub.+(json|yml|yaml)', process.cwd());

    if (configFile) {
      this._rootPath = path.dirname(configFile);
      this._rootConfig = this._getConfig(configFile);
      this._projectConfig = Object.assign({ root: this._rootPath }, this._rootConfig['project']);

      delete this._rootConfig['project'];
    }
  }

  /**
   * Get application root directory
   * @returns {String|Boolean}
   */
  appPath() {
    return this._rootPath;
  }

  /**
   * Get project config
   * @returns {Object}
   */
  getProjectConfig() {
    return this._projectConfig;
  }

  /**
   * Get centralized application config
   * @returns {Object}
   */
  getFullConfig() {
    if (!Object.keys(this._config).length) {
      this._handleRootConfig();
      this._handleComponentConfigs();
    }

    return this._config;
  }

  /**
   * Get list of configuration files
   * @param {*} dir
   * @returns {Array}
   */
  listConfigs(dir = false) {
    const searchPath = dir || this.appPath();

    return searchPath ? this._find('**/.terrahub.+(json|yml|yaml)', searchPath) : [];
  }

  /**
   * Check if project is configured
   * @returns {Boolean}
   */
  isProjectConfigured() {
    return this._projectConfig.hasOwnProperty('name');
  }

  /**
   * Count of configured components
   * @returns {Number}
   */
  componentsCount() {
    return Object.keys(this.getFullConfig()).length;
  }

  /**
   * Separate root config from component's config
   * @private
   */
  _handleRootConfig() {
    Object.keys(this._rootConfig).forEach(key => {
      const cfg = this._rootConfig[key];

      if (cfg.hasOwnProperty('root')) {
        const root = this._relativePath(path.join(this.appPath(), cfg.root));

        cfg.root = root;
        this._config[toMd5(root)] = cfg;
        delete this._rootConfig[key];
      }
    });

    Object.keys(this._config).forEach(module => {
      this._config[module] = extend({}, [this._defaults(), this._rootConfig, this._config[module]]);
    });
  }

  /**
   * Consolidate all components' configs
   * @private
   */
  _handleComponentConfigs() {
    // Remove root config
    const configs = this.listConfigs().slice(1);

    configs.forEach(configPath => {
      const config = this._getConfig(configPath);
      const componentPath = path.dirname(this._relativePath(configPath));

      if (config.hasOwnProperty('parent')) {
        config['parent'] = this._relativePath(path.resolve(componentPath, config.parent));
      }

      this._config[toMd5(componentPath)] = extend({root: componentPath}, [this._defaults(), this._rootConfig, config]);
    });
  }

  /**
   * Find files by pattern
   * @param {String} pattern
   * @param {String} path
   * @returns {*}
   * @private
   */
  _find(pattern, path) {
    return glob.sync(pattern, { cwd: path, absolute: true, dot: true, ignore: ConfigLoader.IGNORE_PATTERNS });
  }

  /**
   * @param {String} fullPath
   * @returns {*}
   * @private
   */
  _relativePath(fullPath) {
    return fullPath.replace(this.appPath(), '.');
  }

  /**
   * Get environment specific config
   * @param {String} cfgPath
   * @return {*}
   * @private
   */
  _getConfig(cfgPath) {
    const cfg = ConfigLoader.readConfig(cfgPath);
    const envPath = path.join(path.dirname(cfgPath), config.fileName);
    const forceWorkspace = { terraform: { workspace: config.env }}; // Just remove to revert
    const overwrite = (objValue, srcValue) => {
      if (Array.isArray(objValue)) {
        return srcValue;
      }
    };

    return (fs.existsSync(envPath) && !config.isDefault)
      ? extend(cfg, [ConfigLoader.readConfig(envPath), forceWorkspace], overwrite)
      : cfg;
  }

  /**
   * @param {String} cfgPath
   * @returns {Object}
   * @private
   */
  static readConfig(cfgPath) {
    const type = path.extname(cfgPath);

    switch (type) {
      case '.yml':
      case '.yaml':
        return yaml.safeLoad(fs.readFileSync(cfgPath));
      case '.json':
        return require(cfgPath);
      default:
        throw new Error(`${type} config is not supported!`);
    }
  }

  /**
   * Glob patterns to exclude matches
   * @returns {String[]}
   * @constructor
   */
  static get IGNORE_PATTERNS() {
    return ['**/node_modules/*'];
  }
}

module.exports = ConfigLoader;
