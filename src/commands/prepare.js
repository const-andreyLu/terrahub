'use strict';

const TerraformCommand = require('../terraform-command');
const Distributor = require('../helpers/distributors/thread-distributor');

class PrepareCommand extends TerraformCommand {
  /**
   * Command configuration
   */
  configure() {
    this
      .setName('prepare')
      .setDescription('run `terraform prepare` across multiple terrahub components')
    ;
  }

  /**
   * @returns {Promise}
   */
  run() {
    const config = this.getConfigObject();
    const distributor = new Distributor(config);

    return distributor.runActions(['prepare']).then(() => Promise.resolve('Done'));
  }
}

module.exports = PrepareCommand;
