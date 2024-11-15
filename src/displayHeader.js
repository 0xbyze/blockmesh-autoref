const colors = require('colors');

function displayHeader() {
  process.stdout.write('\x1Bc');
  console.log(colors.cyan('========================================'));
  console.log(colors.cyan('=    BlockMesh Auto ref                ='));
  console.log(colors.cyan('=    Created by: Bravesid              ='));
  console.log(colors.cyan('=    https://t.me/bravesid             ='));
  console.log(colors.cyan('========================================'));
  console.log(colors.cyan('I\'m not responsible for any loss or damage caused by this bot.'));
  console.log();
}

module.exports = displayHeader;
