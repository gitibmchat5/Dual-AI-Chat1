1 删除现有的.git文件：

rm -rf .git
2 创建.git目录：
mkdir .git
3 重新初始化仓库：

git init

out :
现在应该能正常初始化，显示“Initialized empty Git repository in /Users/cai/Dual AI Chat1/.git/”

4 验证初始化结果：
git status

On branch master
 
 5 git add .