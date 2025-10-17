const handlebars = require('handlebars');
const fs = require('fs').promises;
const path = require('path');
const logger = require('./logger');

const templateCache = new Map();

const loadTemplate = async (templateName) => {
  if (templateCache.has(templateName)) {
    return templateCache.get(templateName);
  }

  try {
    const templateDir = process.env.TEMPLATE_DIR || './src/templates';
    const templatePath = path.join(templateDir, `${templateName}.hbs`);
    const templateContent = await fs.readFile(templatePath, 'utf-8');
    const compiled = handlebars.compile(templateContent);
    templateCache.set(templateName, compiled);
    logger.info(`Template ${templateName} loaded and compiled`);
    return compiled;
  } catch (error) {
    logger.error(`Failed to load template ${templateName}:`, error);
    throw new Error(`Template ${templateName} not found`);
  }
};

const renderTemplate = async (templateName, data) => {
  const template = await loadTemplate(templateName);
  return template(data);
};

const clearCache = () => {
  templateCache.clear();
  logger.info('Template cache cleared');
};

module.exports = { renderTemplate, loadTemplate, clearCache };
