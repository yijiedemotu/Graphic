import { DEFAULT_DIAGRAM_SETTINGS, type DiagramSettings, type ToolConfig, type ToolId } from "./types.ts";

export const TOOLS: ToolConfig[] = [
  { id: "usecase", name: "系统用例图", short: "用例图", symbol: "UC", description: "角色、系统边界与功能用例", hint: "actor 角色；角色 -> 用例（直线 >）；主用例 -> 子用例: include / extend" },
  { id: "dataflow", name: "系统数据流图", short: "数据流图", symbol: "DF", description: "外部实体、处理、数据存储与数据流", hint: "external 外部实体；process 1.0 处理；store D1 数据存储；A -> B: 数据流" },
  { id: "architecture", name: "系统架构图", short: "系统架构图", symbol: "AR", description: "表现层、服务层与数据层", hint: "层名: 模块1; 模块2" },
  { id: "module", name: "系统功能模块图", short: "功能模块图", symbol: "FM", description: "系统、角色分组与功能模块层级", hint: "system 系统名；分组名: 功能1; 功能2" },
  { id: "deployment", name: "UML 部署图", short: "部署图", symbol: "DP", description: "节点、构件与网络通信路径", hint: "node 节点名 | 构件1; 构件2；节点 <-> 节点: 通信方式" },
  { id: "er", name: "ER 属性图", short: "E-R 图", symbol: "ER", description: "实体矩形、属性椭圆与关系菱形", hint: "支持简洁文本或 MySQL CREATE TABLE；自动识别主键、外键与字段注释" },
  { id: "table", name: "数据库物理表结构", short: "三线表", symbol: "TB", description: "数据库表结构的规范三线表", hint: "首行为表头，逗号分隔；含逗号的单元格用英文双引号包裹" },
  { id: "class", name: "UML 类图", short: "类图", symbol: "CL", description: "类、属性、方法与六类关系", hint: "每个 class 一行，关系单独一行；支持 --> -- <|-- o-- *-- ..> ..|>" },
  { id: "sequence", name: "UML 时序图", short: "时序图", symbol: "SQ", description: "参与者、调用与返回消息", hint: "participant 参与者；A -> B: 消息" },
  { id: "flow", name: "系统流程图", short: "流程图", symbol: "FL", description: "开始、处理、判断与分支", hint: "先定义节点，再用箭头连接；默认按连线关系自动分层排版" },
  { id: "environment", name: "环境配置表", short: "环境配置表", symbol: "EC", description: "开发部署环境的规范三线表", hint: "首行为表头；每行填写环境类型,配置详情" },
  { id: "testcase", name: "软件测试用例表", short: "测试用例表", symbol: "TC", description: "测试步骤、输入与预期结果", hint: "首行为表头；建议列：用例编号,测试功能,测试步骤,输入数据,预期结果,实际结果,结论" },
  { id: "chart", name: "实验数据图", short: "实验数据图", symbol: "DT", description: "柱状图、折线图与多组数据", hint: "第一列为横轴，其余列为数据系列；支持正数和负数" },
];

export const THESIS_ROADMAP: Array<{ chapter: string; title: string; note: string; tools: Array<{ id: ToolId; order: number; label: string }> }> = [
  { chapter: "第二章", title: "需求分析", note: "先明确参与者与功能边界，再描述系统内部的数据流动。", tools: [{ id: "usecase", order: 1, label: "用例图" }, { id: "dataflow", order: 2, label: "数据流图（DFD）" }] },
  { chapter: "第三章", title: "总体设计", note: "从整体技术结构进入功能划分，最后交代系统部署方式。", tools: [{ id: "architecture", order: 3, label: "系统架构图" }, { id: "module", order: 4, label: "功能模块图" }, { id: "deployment", order: 5, label: "部署图" }] },
  { chapter: "第四章", title: "详细设计", note: "依次呈现数据模型、物理表、静态结构、交互过程和关键流程。", tools: [{ id: "er", order: 6, label: "E-R 图" }, { id: "table", order: 7, label: "数据库物理表结构" }, { id: "class", order: 8, label: "类图" }, { id: "sequence", order: 9, label: "时序图" }, { id: "flow", order: 10, label: "流程图" }] },
  { chapter: "第五章", title: "系统实现", note: "说明开发与运行环境，交代系统落地所需的软件条件。", tools: [{ id: "environment", order: 11, label: "环境配置表" }] },
  { chapter: "第六章", title: "系统测试", note: "先用测试用例验证功能，再用性能图表总结实验结果。", tools: [{ id: "testcase", order: 12, label: "测试用例表" }, { id: "chart", order: 13, label: "实验性能数据图" }] },
];

export const SAMPLES: Record<ToolId, string> = {
  class: `@title 在线选课系统核心类图
class 学生 | +学号: String; +姓名: String; +专业: String | +选课(): Boolean; +退课(): Boolean
class 课程 | +课程号: String; +课程名: String; +学分: Integer | +更新容量(): void
class 选课记录 | +记录ID: Long; +选课时间: DateTime; +成绩: Float | +录入成绩(): void
class 选课明细 | +明细ID: Long; +教学班: String
class 用户服务 | -学生仓储: Repository | +身份验证(): Boolean
class 缓存用户服务 | -Redis 客户端: Cache | +读取会话(): Session
interface 可统计 | +统计(): Integer
课程 1 --> n 选课记录 : 登记
用户服务 1 ..> n 学生 : 管理
用户服务 <|-- 缓存用户服务 : 继承
缓存用户服务 ..|> 可统计 : 实现
学生 1 o-- n 选课记录 : 持有
选课记录 *-- 选课明细 : 组合`,
  er: `@title 在线选课系统 E-R 图
学生: 学号(PK), 姓名, 专业, 班级, 手机号
课程: 课程号(PK), 课程名, 学分, 课程容量
教师: 工号(PK), 姓名, 职称
选课记录: 记录ID(PK), 学号(FK), 课程号(FK), 成绩
学生 1 -- n 选课记录 : 选修
课程 1 -- n 选课记录 : 对应
教师 1 -- n 课程 : 授课`,
  flow: `@title 用户登录业务流程
开始 [start]
输入账号密码 [process]
校验登录信息 [decision]
记录登录日志 [process]
进入系统首页 [end]
显示错误提示 [end]
开始 -> 输入账号密码
输入账号密码 -> 校验登录信息
校验登录信息 -通过-> 记录登录日志
记录登录日志 -> 进入系统首页
校验登录信息 -失败-> 显示错误提示`,
  dataflow: `@title 校园二手交易平台数据流图
external 学生用户
external 支付平台
process 1.0 发布商品
process 2.0 订单结算
process 3.0 商品审核
store D1 商品表
store D2 订单表
学生用户 -> 1.0 发布商品: 商品信息
1.0 发布商品 -> D1: 写入商品
D1 -> 3.0 商品审核: 待审商品
3.0 商品审核 -> D1: 审核结果
学生用户 -> 2.0 订单结算: 下单请求
2.0 订单结算 -> D2: 生成订单
2.0 订单结算 -> 支付平台: 扣款请求
支付平台 --> 2.0 订单结算: 支付回执`,
  sequence: `@title 用户登录时序图
participant 用户
participant Web 前端
participant 认证服务
participant 数据库
用户 -> Web 前端: 输入账号密码
Web 前端 -> 认证服务: POST /api/login
认证服务 -> 数据库: 查询用户信息
数据库 --> 认证服务: 返回用户记录
认证服务 -> 认证服务: 校验密码并签发 Token
认证服务 --> Web 前端: 登录结果与 Token
Web 前端 --> 用户: 展示系统首页`,
  usecase: `@title 校园二手交易平台用例图
system 校园二手交易平台
actor 学生用户
actor 管理员
# 用户端主要用例
学生用户 -> 用户登录
学生用户 -> 商品浏览与搜索
学生用户 -> 发布商品
学生用户 -> 交易管理
# 管理端主要用例
管理员 -> 用户管理
管理员 -> 商品审核
管理员 -> 订单管理
# 少量包含与扩展关系
商品浏览与搜索 -> 查看商品详情: include
用户管理 -> 查看用户资料: include
订单管理 -> 查询订单详情: include
用户登录 -> 找回密码: extend
交易管理 -> 申请退款: extend
商品审核 -> 下架违规商品: extend`,
  architecture: `@title 校园二手交易平台系统架构
表现层: 移动端小程序; Web 管理后台
接口层: REST API; WebSocket; 权限拦截器
业务层: 用户服务; 商品服务; 订单服务; 消息服务
数据层: MySQL; Redis; 对象存储
基础设施: 日志中心; 定时任务; Docker`,
  deployment: `@title 校园二手交易平台部署图
node 客户端 | Chrome 浏览器; 微信小程序
node 接入层服务器 | Nginx; HTTPS 证书
node 应用服务器 | Spring Boot 应用; 定时任务; 消息队列客户端
node 数据服务器 | MySQL 8.0; Redis 7
node 对象存储 | MinIO 图片桶
客户端 <-> 接入层服务器: HTTPS 443
接入层服务器 <-> 应用服务器: 反向代理
应用服务器 <-> 数据服务器: TCP 3306 / 6379
应用服务器 <-> 对象存储: S3 API`,
  module: `@title 图 4.2 系统功能模块图
system 二手交易平台
学生用户: 浏览搜索商品; 发布管理商品; 注册登录; 个人信息管理; AI客服; 商品留言评论
管理员用户: 商品管理; 用户管理; 订单管理; 公告管理; 数据统计`,
  table: `@title 表 4-2 用户信息表
字段名,数据类型,长度,允许为空,说明
user_id,BIGINT,20,否,用户主键
username,VARCHAR,50,否,登录用户名
password,VARCHAR,255,否,加密密码
email,VARCHAR,100,是,电子邮箱
created_at,DATETIME,—,否,创建时间`,
  environment: `@title 表 2.1 系统开发与部署环境配置表
环境类型,配置详情
操作系统,Windows 11 专业版 x64
CPU,Intel(R) Core(TM) i7-12700H CPU @ 2.30GHz
运行内存,16 GB
后端开发工具,IntelliJ IDEA 2024.1
后端运行环境,JDK 17.0.8
后端构建工具,Maven 3.8.1
前端开发工具,Visual Studio Code 1.85
前端运行环境,Node.js 18.16.0
前端构建工具,Vite 4.4.0
数据库,MySQL 8.0.33
接口测试工具,Apifox 2.5.0
版本控制,Git 2.40.0`,
  testcase: `@title 表 6-1 系统功能测试用例表
用例编号,测试功能,测试步骤,输入数据,预期结果,实际结果,结论
TC-01,用户登录,打开登录页并提交,正确账号密码,跳转首页并显示昵称,与预期一致,通过
TC-02,用户登录,提交错误密码,正确账号错误密码,提示密码错误并留在登录页,与预期一致,通过
TC-03,商品发布,上传图片并提交,标题与 3 张图片,商品进入待审核状态,状态未更新,待修复
TC-04,订单结算,选择商品并支付,库存充足的商品,生成订单且库存减 1,与预期一致,通过`,
  chart: `@title 不同并发量下的平均响应时间
并发用户数,优化前,优化后
50,126,82
100,238,141
150,387,224
200,562,318
250,741,426`,
};

export const ER_SQL_SAMPLE = `@title 在线选课系统数据库 E-R 图
CREATE TABLE \`student\` (
  \`student_id\` BIGINT NOT NULL COMMENT '学号',
  \`name\` VARCHAR(50) NOT NULL COMMENT '姓名',
  \`major\` VARCHAR(80) COMMENT '专业',
  PRIMARY KEY (\`student_id\`)
) COMMENT='学生';

CREATE TABLE \`course\` (
  \`course_id\` BIGINT NOT NULL COMMENT '课程号',
  \`course_name\` VARCHAR(100) NOT NULL COMMENT '课程名',
  \`credit\` DECIMAL(3,1) COMMENT '学分',
  PRIMARY KEY (\`course_id\`)
) COMMENT='课程';

CREATE TABLE \`enrollment\` (
  \`record_id\` BIGINT NOT NULL COMMENT '记录ID',
  \`student_id\` BIGINT NOT NULL COMMENT '学号',
  \`course_id\` BIGINT NOT NULL COMMENT '课程号',
  \`score\` DECIMAL(5,2) COMMENT '成绩',
  PRIMARY KEY (\`record_id\`),
  CONSTRAINT \`fk_enrollment_student\` FOREIGN KEY (\`student_id\`) REFERENCES \`student\` (\`student_id\`),
  CONSTRAINT \`fk_enrollment_course\` FOREIGN KEY (\`course_id\`) REFERENCES \`course\` (\`course_id\`)
) COMMENT='选课记录';`;

export const TABLE_NOTE_TEXT = "注：— 表示不限制长度；数据来源为系统数据库设计。";

export const defaultSettingsForTool = (id: ToolId): DiagramSettings => ({
  ...DEFAULT_DIAGRAM_SETTINGS,
  spacingScale: id === "architecture" ? 115 : DEFAULT_DIAGRAM_SETTINGS.spacingScale,
  showTableNote: id === "table" ? DEFAULT_DIAGRAM_SETTINGS.showTableNote : false,
});

export const createDefaultSettingsByTool = (): Record<ToolId, DiagramSettings> => Object.fromEntries(
  TOOLS.map(({ id }) => [id, defaultSettingsForTool(id)]),
) as Record<ToolId, DiagramSettings>;
