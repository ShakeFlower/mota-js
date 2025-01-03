/*
 * 表格配置项。
 * 在这里可以对表格中的各项显示进行配置，包括表格项、提示内容等内容。具体写法照葫芦画瓢即可。
 * 本配置项包括：插件编写。
 * 相关文档 _docs/editor.md ~ http://127.0.0.1:1055/_docs/#/editor?id=修改表格
 */

var plugins_comment_c456ea59_6018_45ef_8bcc_211a24c627dc = {
	"_type": "object",
	"_data": function (key) {
		var obj = {
			"init": {
				"_leaf": true,
				"_type": "textarea",
				"_range": "typeof(thiseval)=='string'",
				"_data": "自定义插件"
			},
			"shop": {
				"_leaf": true,
				"_type": "textarea",
				"_range": "typeof(thiseval)=='string'",
				"_data": "全局商店"
			},
			"removeMap": {
				"_leaf": true,
				"_type": "textarea",
				"_range": "typeof(thiseval)=='string' || thiseval==null",
				"_data": "砍层插件"
			},
			"fiveLayers": {
				"_leaf": true,
				"_type": "textarea",
				"_range": "typeof(thiseval)=='string' || thiseval==null",
				"_data": "五图层(背景前景2)"
			},
			"itemShop": {
				"_leaf": true,
				"_type": "textarea",
				"_range": "typeof(thiseval)=='string' || thiseval==null",
				"_data": "道具商店"
			},
			"enemyLevel": {
				"_leaf": true,
				"_type": "textarea",
				"_range": "typeof(thiseval)=='string' || thiseval==null",
				"_data": "手册显示怪物境界"
			},
			"multiHeros": {
				"_leaf": true,
				"_type": "textarea",
				"_range": "typeof(thiseval)=='string' || thiseval==null",
				"_data": "多角色"
			},
			"heroFourFrames": {
				"_leaf": true,
				"_type": "textarea",
				"_range": "typeof(thiseval)=='string' || thiseval==null",
				"_data": "勇士四帧行走动画"
			},
			"startCanvas": {
				"_leaf": true,
				"_type": "textarea",
				"_range": "typeof(thiseval)=='string' || thiseval==null",
				"_data": "自绘标题界面居中"
			},
			"advancedAnimation": {
				"_leaf": true,
				"_type": "textarea",
				"_range": "typeof(thiseval)=='string' || thiseval==null",
				"_data": "高级动画"
			},
			"drawItemDetail": {
				"_leaf": true,
				"_type": "textarea",
				"_range": "typeof(thiseval)=='string' || thiseval==null",
				"_data": "物品数据显示"
			},
			"autoGet": {
				"_leaf": true,
				"_type": "textarea",
				"_range": "typeof(thiseval)=='string' || thiseval==null",
				"_data": "自动拾取&清怪"
			},
			"newBackpackLook": {
				"_leaf": true,
				"_type": "textarea",
				"_range": "typeof(thiseval)=='string' || thiseval==null",
				"_data": "新版道具栏"
			},
			"scrollingText": {
				"_leaf": true,
				"_type": "textarea",
				"_range": "typeof(thiseval)=='string' || thiseval==null",
				"_data": "接收&发送弹幕"
			},
		}
		if (obj[key]) return obj[key];
		return {
			"_leaf": true,
			"_type": "textarea",
			"_range": "typeof(thiseval)=='string' || thiseval==null",
			"_template": "function () {\\n\\t// 在此增加新插件\\n\\t\\n}",
			"_data": "自定义插件"
		}
	}
}