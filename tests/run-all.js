'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const repositoryRoot = path.resolve(__dirname, '..');
const pluginDirectory = path.join(repositoryRoot, 'plugins', 'fasttag');
const javascriptFiles = fs.readdirSync(pluginDirectory)
    .filter(name => /^fasttag(?:-[a-z]+)?\.js$/.test(name))
    .sort();
const testFiles = fs.readdirSync(__dirname)
    .filter(name => name.endsWith('.test.js'))
    .sort();
const pythonFiles = fs.readdirSync(pluginDirectory)
    .filter(name => /^fasttag.*\.py$/.test(name))
    .sort();

function runNode(arguments_, label) {
    const result = spawnSync(process.execPath, arguments_, {
        cwd: repositoryRoot,
        encoding: 'utf8'
    });
    if (result.stdout) process.stdout.write(result.stdout);
    if (result.stderr) process.stderr.write(result.stderr);
    if (result.status !== 0) {
        console.error(`FAILED: ${label}`);
        process.exit(result.status || 1);
    }
}

for (const file of javascriptFiles) {
    runNode(['--check', path.join(pluginDirectory, file)], `syntax ${file}`);
}
if (pythonFiles.length > 0) {
    const pythonSyntaxCheck = spawnSync('python3', [
        '-c',
        'import ast, pathlib, sys; [ast.parse(pathlib.Path(p).read_text(), filename=p) for p in sys.argv[1:]]',
        ...pythonFiles.map(file => path.join(pluginDirectory, file))
    ], { cwd: repositoryRoot, encoding: 'utf8' });
    if (pythonSyntaxCheck.stdout) process.stdout.write(pythonSyntaxCheck.stdout);
    if (pythonSyntaxCheck.stderr) process.stderr.write(pythonSyntaxCheck.stderr);
    if (pythonSyntaxCheck.status !== 0) process.exit(pythonSyntaxCheck.status || 1);
}
for (const file of testFiles) {
    runNode([path.join(__dirname, file)], file);
}

console.log(`FastTag verification passed: ${javascriptFiles.length} JavaScript syntax checks, ${pythonFiles.length} Python syntax checks, ${testFiles.length} test suites.`);
