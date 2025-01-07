const fs = require('fs');
const path = require('path');

// 输入文件和输出目录
const inputFile = 'proxy.txt';
const outputDir = './config/';

// 每个文件最大条数
const batchSize = 5;

try {
  // 读取 proxies.txt 文件
  const data = fs.readFileSync(inputFile, 'utf8');
  const lines = data.trim().split('\n');

  // 将每行数据转换为指定格式
  const formattedLines = lines.map((line) => {
    const [user, host] = line.split('@');
    return `http://${line}`;
    // return `http://${user}@${host}`;
  });

  // 分割数据并写入多个文件
  let fileIndex = 0;
  for (let i = 0; i < formattedLines.length; i += batchSize) {
    // 取当前批次数据
    const batch = formattedLines.slice(i, i + batchSize);
    const fileName = path.join(outputDir, `${fileIndex + 1}.txt`);
    fs.writeFileSync(fileName, batch.join('\n'), 'utf8');
    console.log(`Written ${batch.length} proxies to ${fileName}`);
    fileIndex++;
  }

  console.log('All files written successfully!');
} catch (error) {
  console.error('Error processing proxies:', error.message);
}