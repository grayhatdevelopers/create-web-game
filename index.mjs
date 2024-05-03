#!/usr/bin/env node
import { program } from 'commander';
import inquirer from 'inquirer';
import download from 'download-git-repo';
import ora from 'ora';
import chalk from 'chalk';
import path from 'path';
import _ from 'lodash';
import fs from 'fs/promises'; // Import promises version of fs for async file operations

import templates from './templates.mjs';
import { replaceInDirectory } from './replacer.mjs';

const DEFAULT_CONFIG_NAME = 'create-multiplayer-game.config.js'

program
  .version('1.0.0')
  .arguments('[project-name]')
  .option('-t, --template <template>', 'Specify the template')
  .option('-c, --config <config>', 'Specify the configuration file')
  .parse(process.argv);

async function run() {
  let projectName = program.args[0];
  let gameName = projectName;
  let templateChoice = program.template;
  let configPath = program.config || DEFAULT_CONFIG_NAME; // Default config file path

  // Check if config file exists
  let configExists = false;
  try {
    await fs.access(configPath);
    configExists = true;
  } catch (err) {
    // Config file doesn't exist, continue without it
  }

  // If config file exists, read configuration from it
  if (configExists) {
    const config = require(path.resolve(configPath));
    if (config.projectName) projectName = config.projectName;
    if (config.gameName) gameName = config.gameName;
    if (config.templateChoice) templateChoice = config.templateChoice;
  } else {
    // If config file doesn't exist, prompt user for input
    if (!projectName) {
      const answersGameName = await inquirer.prompt([
        {
          type: 'input',
          name: 'gameName',
          message: 'What will you call your game?',
          validate: (input) => !!input.trim(),
        },
      ]);
      gameName = answersGameName.gameName;

      const kebabCaseGameName = _.kebabCase(gameName);

      const answers = await inquirer.prompt([
        {
          type: 'input',
          name: 'projectName',
          message: 'Enter the project name:',
          default: kebabCaseGameName,
          validate: (input) => !!input.trim(),
        },
      ]);
      projectName = answers.projectName;
    }

    if (!templateChoice) {
      const answers = await inquirer.prompt([
        {
          type: 'list',
          name: 'templateChoice',
          message: 'Which template would you like to use?',
          choices: templates.map((template) => template.id),
        },
      ]);
      templateChoice = answers.templateChoice;
    }
  }

  const templateRepoUrl = templates.find((template) => template.id === templateChoice).url;
  const targetPath = path.join(process.cwd(), projectName);
  const spinner = ora('Downloading project template...').start();

  download(templateRepoUrl, targetPath, { clone: true }, (err) => {
    if (err) {
      spinner.fail(chalk.red('Failed to download project template.'));
      console.error(err);
    } else {
      // Cookie cutting
      replaceInDirectory(targetPath, new RegExp('%GAME_NAME%', 'g'), gameName);

      spinner.succeed(chalk.green('Project template downloaded successfully.'));
      console.log(chalk.yellow(`\nProject initialized at ${targetPath}`));

      console.log(chalk.cyan('\nHappy coding!'));

      // Write configuration to file
      const configData = `
        module.exports = {
          projectName: '${projectName}',
          gameName: '${gameName}',
          templateChoice: '${templateChoice}'
        };
      `;
      fs.writeFile(path.join(targetPath, DEFAULT_CONFIG_NAME), configData)
        .then(() => console.log(chalk.green(`Configuration saved to ${configPath}`)))
        .catch((err) => console.error(chalk.red(`Error writing configuration file: ${err.message}`)));
    }
  });
}

run();
