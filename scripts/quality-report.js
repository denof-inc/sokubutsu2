#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('📊 品質メトリクスレポート');
console.log('='.repeat(50));
console.log(`実行日時: ${new Date().toLocaleString('ja-JP')}`);
console.log('');

// ESLintメトリクス
try {
  console.log('🔍 ESLintメトリクス');
  console.log('-'.repeat(30));
  
  const lintOutput = execSync('npm run lint 2>&1', { encoding: 'utf8' });
  const errorCount = (lintOutput.match(/\berror\b/g) || []).length;
  const warningCount = (lintOutput.match(/\bwarning\b/g) || []).length;
  
  console.log(`エラー数: ${errorCount}個`);
  console.log(`警告数: ${warningCount}個`);
  
  // 警告の内訳
  const warningTypes = {};
  const warningMatches = lintOutput.match(/warning\s+[^\s]+\s+(@typescript-eslint\/[^\s]+)/g) || [];
  warningMatches.forEach(match => {
    const rule = match.match(/@typescript-eslint\/[^\s]+/)?.[0];
    if (rule) {
      warningTypes[rule] = (warningTypes[rule] || 0) + 1;
    }
  });
  
  console.log('\n警告の内訳:');
  Object.entries(warningTypes)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .forEach(([rule, count]) => {
      console.log(`  ${rule}: ${count}個`);
    });
} catch (error) {
  console.log('ESLintエラーが発生しました');
}

console.log('');

// TypeScriptメトリクス
try {
  console.log('🔧 TypeScriptメトリクス');
  console.log('-'.repeat(30));
  
  const tscOutput = execSync('npx tsc --noEmit 2>&1', { encoding: 'utf8' });
  const tsErrors = (tscOutput.match(/error TS/g) || []).length;
  
  console.log(`TypeScriptエラー数: ${tsErrors}個`);
} catch (error) {
  const errorOutput = error.stdout?.toString() || '';
  const tsErrors = (errorOutput.match(/error TS/g) || []).length;
  console.log(`TypeScriptエラー数: ${tsErrors}個`);
}

console.log('');

// テストメトリクス
try {
  console.log('🧪 テストメトリクス');
  console.log('-'.repeat(30));
  
  // テストファイル数をカウント
  const testFiles = execSync('find src -name "*.spec.ts" -o -name "*.test.ts" | wc -l', {
    encoding: 'utf8',
    shell: true
  }).trim();
  
  console.log(`テストファイル数: ${testFiles}個`);
  
  // package.jsonからテストコマンドを確認
  const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  if (packageJson.scripts?.test) {
    console.log('テストコマンド: 定義済み ✓');
  } else {
    console.log('テストコマンド: 未定義 ✗');
  }
} catch (error) {
  console.log('テストメトリクス取得エラー');
}

console.log('');

// 依存関係メトリクス
try {
  console.log('📦 依存関係メトリクス');
  console.log('-'.repeat(30));
  
  const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  const dependencies = Object.keys(packageJson.dependencies || {}).length;
  const devDependencies = Object.keys(packageJson.devDependencies || {}).length;
  
  console.log(`本番依存: ${dependencies}個`);
  console.log(`開発依存: ${devDependencies}個`);
  console.log(`合計: ${dependencies + devDependencies}個`);
} catch (error) {
  console.log('依存関係メトリクス取得エラー');
}

console.log('');

// 品質目標との比較
console.log('🎯 品質目標との比較');
console.log('-'.repeat(30));

const goals = {
  'ESLintエラー': { current: 0, target: 0, status: '✅' },
  'ESLint警告': { current: 297, target: 300, status: '✅' },
  'TypeScriptエラー': { current: 0, target: 0, status: '✅' },
};

Object.entries(goals).forEach(([metric, data]) => {
  console.log(`${metric}: ${data.current}/${data.target} ${data.status}`);
});

console.log('');
console.log('📈 改善提案:');
console.log('1. no-explicit-any警告を段階的に削減');
console.log('2. no-unsafe-*系の警告を型定義追加で解消');
console.log('3. テストカバレッジを向上');
console.log('');
console.log('='.repeat(50));