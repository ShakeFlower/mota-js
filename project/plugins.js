/// <reference path="../runtime.d.ts" />
var plugins_bb40132b_638b_4a9f_b028_d3fe47acc8d1 =
{
	"init": function () {

		console.log("插件编写测试");

		// 可以写一些直接执行的代码
		// 在这里写的代码将会在【资源加载前】被执行，此时图片等资源尚未被加载。
		// 请勿在这里对包括bgm，图片等资源进行操作。


		this._afterLoadResources = function () {
			// 本函数将在所有资源加载完毕后，游戏开启前被执行
			// 可以在这个函数里面对资源进行一些操作。
			// 若需要进行切分图片，可以使用 core.splitImage() 函数，或直接在全塔属性-图片切分中操作
		}

		// 可以在任何地方（如afterXXX或自定义脚本事件）调用函数，方法为 core.plugin.xxx();
		// 从V2.6开始，插件中用this.XXX方式定义的函数也会被转发到core中，详见文档-脚本-函数的转发。
	},
	"shop": function () {
		// 【全局商店】相关的功能
		// 
		// 打开一个全局商店
		// shopId：要打开的商店id；noRoute：是否不计入录像
		this.openShop = function (shopId, noRoute) {
			var shop = core.status.shops[shopId];
			// Step 1: 检查能否打开此商店
			if (!this.canOpenShop(shopId)) {
				core.drawTip("该商店尚未开启");
				return false;
			}

			// Step 2: （如有必要）记录打开商店的脚本事件
			if (!noRoute) {
				core.status.route.push("shop:" + shopId);
			}

			// Step 3: 检查道具商店 or 公共事件
			if (shop.item) {
				if (core.openItemShop) {
					core.openItemShop(shopId);
				} else {
					core.playSound('操作失败');
					core.insertAction("道具商店插件不存在！请检查是否存在该插件！");
				}
				return;
			}
			if (shop.commonEvent) {
				core.insertCommonEvent(shop.commonEvent, shop.args);
				return;
			}

			_shouldProcessKeyUp = true;

			// Step 4: 执行标准公共商店    
			core.insertAction(this._convertShop(shop));
			return true;
		}

		////// 将一个全局商店转变成可预览的公共事件 //////
		this._convertShop = function (shop) {
			return [
				{ "type": "function", "function": "function() {core.addFlag('@temp@shop', 1);}" },
				{
					"type": "while",
					"condition": "true",
					"data": [
						// 检测能否访问该商店
						{
							"type": "if",
							"condition": "core.isShopVisited('" + shop.id + "')",
							"true": [
								// 可以访问，直接插入执行效果
								{ "type": "function", "function": "function() { core.plugin._convertShop_replaceChoices('" + shop.id + "', false) }" },
							],
							"false": [
								// 不能访问的情况下：检测能否预览
								{
									"type": "if",
									"condition": shop.disablePreview,
									"true": [
										// 不可预览，提示并退出
										{ "type": "playSound", "name": "操作失败" },
										"当前无法访问该商店！",
										{ "type": "break" },
									],
									"false": [
										// 可以预览：将商店全部内容进行替换
										{ "type": "tip", "text": "当前处于预览模式，不可购买" },
										{ "type": "function", "function": "function() { core.plugin._convertShop_replaceChoices('" + shop.id + "', true) }" },
									]
								}
							]
						}
					]
				},
				{ "type": "function", "function": "function() {core.addFlag('@temp@shop', -1);}" }
			];
		}

		this._convertShop_replaceChoices = function (shopId, previewMode) {
			var shop = core.status.shops[shopId];
			var choices = (shop.choices || []).filter(function (choice) {
				if (choice.condition == null || choice.condition == '') return true;
				try { return core.calValue(choice.condition); } catch (e) { return true; }
			}).map(function (choice) {
				var ableToBuy = core.calValue(choice.need);
				return {
					"text": choice.text,
					"icon": choice.icon,
					"color": ableToBuy && !previewMode ? choice.color : [153, 153, 153, 1],
					"action": ableToBuy && !previewMode ? [{ "type": "playSound", "name": "商店" }].concat(choice.action) : [
						{ "type": "playSound", "name": "操作失败" },
						{ "type": "tip", "text": previewMode ? "预览模式下不可购买" : "购买条件不足" }
					]
				};
			}).concat({ "text": "离开", "action": [{ "type": "playSound", "name": "取消" }, { "type": "break" }] });
			core.insertAction({ "type": "choices", "text": shop.text, "choices": choices });
		}

		/// 是否访问过某个快捷商店
		this.isShopVisited = function (id) {
			if (!core.hasFlag("__shops__")) core.setFlag("__shops__", {});
			var shops = core.getFlag("__shops__");
			if (!shops[id]) shops[id] = {};
			return shops[id].visited;
		}

		/// 当前应当显示的快捷商店列表
		this.listShopIds = function () {
			return Object.keys(core.status.shops).filter(function (id) {
				return core.isShopVisited(id) || !core.status.shops[id].mustEnable;
			});
		}

		/// 是否能够打开某个商店
		this.canOpenShop = function (id) {
			if (this.isShopVisited(id)) return true;
			var shop = core.status.shops[id];
			if (shop.item || shop.commonEvent || shop.mustEnable) return false;
			return true;
		}

		/// 启用或禁用某个快捷商店
		this.setShopVisited = function (id, visited) {
			if (!core.hasFlag("__shops__")) core.setFlag("__shops__", {});
			var shops = core.getFlag("__shops__");
			if (!shops[id]) shops[id] = {};
			if (visited) shops[id].visited = true;
			else delete shops[id].visited;
		}

		/// 能否使用快捷商店
		this.canUseQuickShop = function (id) {
			// 如果返回一个字符串，表示不能，字符串为不能使用的提示
			// 返回null代表可以使用

			// 检查当前楼层的canUseQuickShop选项是否为false
			if (core.status.thisMap.canUseQuickShop === false)
				return '当前楼层不能使用快捷商店。';
			return null;
		}

		var _shouldProcessKeyUp = true;

		/// 允许商店X键退出
		core.registerAction('keyUp', 'shops', function (keycode) {
			if (!core.status.lockControl || core.status.event.id != 'action') return false;
			if ((keycode == 13 || keycode == 32) && !_shouldProcessKeyUp) {
				_shouldProcessKeyUp = true;
				return true;
			}

			if (!core.hasFlag("@temp@shop") || core.status.event.data.type != 'choices') return false;
			var data = core.status.event.data.current;
			var choices = data.choices;
			var topIndex = core.actions._getChoicesTopIndex(choices.length);
			if (keycode == 88 || keycode == 27) { // X, ESC
				core.actions._clickAction(core.actions.HSIZE, topIndex + choices.length - 1);
				return true;
			}
			return false;
		}, 60);

		/// 允许长按空格或回车连续执行操作
		core.registerAction('keyDown', 'shops', function (keycode) {
			if (!core.status.lockControl || !core.hasFlag("@temp@shop") || core.status.event.id != 'action') return false;
			if (core.status.event.data.type != 'choices') return false;
			core.status.onShopLongDown = true;
			var data = core.status.event.data.current;
			var choices = data.choices;
			var topIndex = core.actions._getChoicesTopIndex(choices.length);
			if (keycode == 13 || keycode == 32) { // Space, Enter
				core.actions._clickAction(core.actions.HSIZE, topIndex + core.status.event.selection);
				_shouldProcessKeyUp = false;
				return true;
			}
			return false;
		}, 60);

		// 允许长按屏幕连续执行操作
		core.registerAction('longClick', 'shops', function (x, y, px, py) {
			if (!core.status.lockControl || !core.hasFlag("@temp@shop") || core.status.event.id != 'action') return false;
			if (core.status.event.data.type != 'choices') return false;
			var data = core.status.event.data.current;
			var choices = data.choices;
			var topIndex = core.actions._getChoicesTopIndex(choices.length);
			if (x >= core.actions.CHOICES_LEFT && x <= core.actions.CHOICES_RIGHT && y >= topIndex && y < topIndex + choices.length) {
				core.actions._clickAction(x, y);
				return true;
			}
			return false;
		}, 60);
	},
	"removeMap": function () {
		// 高层塔砍层插件，删除后不会存入存档，不可浏览地图也不可飞到。
		// 推荐用法：
		// 对于超高层或分区域塔，当在1区时将2区以后的地图删除；1区结束时恢复2区，进二区时删除1区地图，以此类推
		// 这样可以大幅减少存档空间，以及加快存读档速度

		// 删除楼层
		// core.removeMaps("MT1", "MT300") 删除MT1~MT300之间的全部层
		// core.removeMaps("MT10") 只删除MT10层
		this.removeMaps = function (fromId, toId) {
			toId = toId || fromId;
			var fromIndex = core.floorIds.indexOf(fromId),
				toIndex = core.floorIds.indexOf(toId);
			if (toIndex < 0) toIndex = core.floorIds.length - 1;
			flags.__visited__ = flags.__visited__ || {};
			flags.__removed__ = flags.__removed__ || [];
			flags.__disabled__ = flags.__disabled__ || {};
			flags.__leaveLoc__ = flags.__leaveLoc__ || {};
			for (var i = fromIndex; i <= toIndex; ++i) {
				var floorId = core.floorIds[i];
				if (core.status.maps[floorId].deleted) continue;
				delete flags.__visited__[floorId];
				flags.__removed__.push(floorId);
				delete flags.__disabled__[floorId];
				delete flags.__leaveLoc__[floorId];
				(core.status.autoEvents || []).forEach(function (event) {
					if (event.floorId == floorId && event.currentFloor) {
						core.autoEventExecuting(event.symbol, false);
						core.autoEventExecuted(event.symbol, false);
					}
				});
				core.status.maps[floorId].deleted = true;
				core.status.maps[floorId].canFlyTo = false;
				core.status.maps[floorId].canFlyFrom = false;
				core.status.maps[floorId].cannotViewMap = true;
			}
		}

		// 恢复楼层
		// core.resumeMaps("MT1", "MT300") 恢复MT1~MT300之间的全部层
		// core.resumeMaps("MT10") 只恢复MT10层
		this.resumeMaps = function (fromId, toId) {
			toId = toId || fromId;
			var fromIndex = core.floorIds.indexOf(fromId),
				toIndex = core.floorIds.indexOf(toId);
			if (toIndex < 0) toIndex = core.floorIds.length - 1;
			flags.__removed__ = flags.__removed__ || [];
			for (var i = fromIndex; i <= toIndex; ++i) {
				var floorId = core.floorIds[i];
				if (!core.status.maps[floorId].deleted) continue;
				flags.__removed__ = flags.__removed__.filter(function (f) { return f != floorId; });
				core.status.maps[floorId] = core.loadFloor(floorId);
			}
		}

		// 分区砍层相关
		var inAnyPartition = function (floorId) {
			var inPartition = false;
			(core.floorPartitions || []).forEach(function (floor) {
				var fromIndex = core.floorIds.indexOf(floor[0]);
				var toIndex = core.floorIds.indexOf(floor[1]);
				var index = core.floorIds.indexOf(floorId);
				if (fromIndex < 0 || index < 0) return;
				if (toIndex < 0) toIndex = core.floorIds.length - 1;
				if (index >= fromIndex && index <= toIndex) inPartition = true;
			});
			return inPartition;
		}

		// 分区砍层
		this.autoRemoveMaps = function (floorId) {
			if (main.mode != 'play' || !inAnyPartition(floorId)) return;
			// 根据分区信息自动砍层与恢复
			(core.floorPartitions || []).forEach(function (floor) {
				var fromIndex = core.floorIds.indexOf(floor[0]);
				var toIndex = core.floorIds.indexOf(floor[1]);
				var index = core.floorIds.indexOf(floorId);
				if (fromIndex < 0 || index < 0) return;
				if (toIndex < 0) toIndex = core.floorIds.length - 1;
				if (index >= fromIndex && index <= toIndex) {
					core.resumeMaps(core.floorIds[fromIndex], core.floorIds[toIndex]);
				} else {
					core.removeMaps(core.floorIds[fromIndex], core.floorIds[toIndex]);
				}
			});
		}
	},
	"fiveLayers": function () {
		// 是否启用五图层（增加背景2层和前景2层） 将__enable置为true即会启用；启用后请保存后刷新编辑器
		// 背景层2将会覆盖背景层 被事件层覆盖 前景层2将会覆盖前景层
		// 另外 请注意加入两个新图层 会让大地图的性能降低一些
		// 插件作者：ad
		var __enable = false;
		if (!__enable) return;

		// 创建新图层
		function createCanvas(name, zIndex) {
			if (!name) return;
			var canvas = document.createElement('canvas');
			canvas.id = name;
			canvas.className = 'gameCanvas';
			// 编辑器模式下设置zIndex会导致加入的图层覆盖优先级过高
			if (main.mode != "editor") canvas.style.zIndex = zIndex || 0;
			// 将图层插入进游戏内容
			document.getElementById('gameDraw').appendChild(canvas);
			var ctx = canvas.getContext('2d');
			core.canvas[name] = ctx;
			canvas.width = core.__PIXELS__;
			canvas.height = core.__PIXELS__;
			return canvas;
		}

		var bg2Canvas = createCanvas('bg2', 20);
		var fg2Canvas = createCanvas('fg2', 63);
		// 大地图适配
		core.bigmap.canvas = ["bg2", "fg2", "bg", "event", "event2", "fg", "damage"];
		core.initStatus.bg2maps = {};
		core.initStatus.fg2maps = {};

		if (main.mode == 'editor') {
			/*插入编辑器的图层 不做此步新增图层无法在编辑器显示*/
			// 编辑器图层覆盖优先级 eui > efg > fg(前景层) > event2(48*32图块的事件层) > event(事件层) > bg(背景层)
			// 背景层2(bg2) 插入事件层(event)之前(即bg与event之间)
			document.getElementById('mapEdit').insertBefore(bg2Canvas, document.getElementById('event'));
			// 前景层2(fg2) 插入编辑器前景(efg)之前(即fg之后)
			document.getElementById('mapEdit').insertBefore(fg2Canvas, document.getElementById('ebm'));
			// 原本有三个图层 从4开始添加
			var num = 4;
			// 新增图层存入editor.dom中
			editor.dom.bg2c = core.canvas.bg2.canvas;
			editor.dom.bg2Ctx = core.canvas.bg2;
			editor.dom.fg2c = core.canvas.fg2.canvas;
			editor.dom.fg2Ctx = core.canvas.fg2;
			editor.dom.maps.push('bg2map', 'fg2map');
			editor.dom.canvas.push('bg2', 'fg2');

			// 创建编辑器上的按钮
			var createCanvasBtn = function (name) {
				// 电脑端创建按钮
				var input = document.createElement('input');
				// layerMod4/layerMod5
				var id = 'layerMod' + num++;
				// bg2map/fg2map
				var value = name + 'map';
				input.type = 'radio';
				input.name = 'layerMod';
				input.id = id;
				input.value = value;
				editor.dom[id] = input;
				input.onchange = function () {
					editor.uifunctions.setLayerMod(value);
				}
				return input;
			};

			var createCanvasBtn_mobile = function (name) {
				// 手机端往选择列表中添加子选项
				var input = document.createElement('option');
				var id = 'layerMod' + num++;
				var value = name + 'map';
				input.name = 'layerMod';
				input.value = value;
				editor.dom[id] = input;
				return input;
			};
			if (!editor.isMobile) {
				var input = createCanvasBtn('bg2');
				var input2 = createCanvasBtn('fg2');
				// 获取事件层及其父节点
				var child = document.getElementById('layerMod'),
					parent = child.parentNode;
				// 背景层2插入事件层前
				parent.insertBefore(input, child);
				// 不能直接更改背景层2的innerText 所以创建文本节点
				var txt = document.createTextNode('bg2');
				// 插入事件层前(即新插入的背景层2前)
				parent.insertBefore(txt, child);
				// 向最后插入前景层2(即插入前景层后)
				parent.appendChild(input2);
				var txt2 = document.createTextNode('fg2');
				parent.appendChild(txt2);
				parent.childNodes[2].replaceWith("bg");
				parent.childNodes[6].replaceWith("事件");
				parent.childNodes[8].replaceWith("fg");
			} else {
				var input = createCanvasBtn_mobile('bg2');
				var input2 = createCanvasBtn_mobile('fg2');
				// 手机端因为是选项 所以可以直接改innerText
				input.innerText = '背景层2';
				input2.innerText = '前景层2';
				var parent = document.getElementById('layerMod');
				parent.insertBefore(input, parent.children[1]);
				parent.appendChild(input2);
			}
		}

		var _loadFloor_doNotCopy = core.maps._loadFloor_doNotCopy;
		core.maps._loadFloor_doNotCopy = function () {
			return ["bg2map", "fg2map"].concat(_loadFloor_doNotCopy());
		}
		////// 绘制背景和前景层 //////
		core.maps._drawBg_draw = function (floorId, toDrawCtx, cacheCtx, config) {
			config.ctx = cacheCtx;
			core.maps._drawBg_drawBackground(floorId, config);
			// ------ 调整这两行的顺序来控制是先绘制贴图还是先绘制背景图块；后绘制的覆盖先绘制的。
			core.maps._drawFloorImages(floorId, config.ctx, 'bg', null, null, config.onMap);
			core.maps._drawBgFgMap(floorId, 'bg', config);
			if (config.onMap) {
				core.drawImage(toDrawCtx, cacheCtx.canvas, core.bigmap.v2 ? -32 : 0, core.bigmap.v2 ? -32 : 0);
				core.clearMap('bg2');
				core.clearMap(cacheCtx);
			}
			core.maps._drawBgFgMap(floorId, 'bg2', config);
			if (config.onMap) core.drawImage('bg2', cacheCtx.canvas, core.bigmap.v2 ? -32 : 0, core.bigmap.v2 ? -32 : 0);
			config.ctx = toDrawCtx;
		}
		core.maps._drawFg_draw = function (floorId, toDrawCtx, cacheCtx, config) {
			config.ctx = cacheCtx;
			// ------ 调整这两行的顺序来控制是先绘制贴图还是先绘制前景图块；后绘制的覆盖先绘制的。
			core.maps._drawFloorImages(floorId, config.ctx, 'fg', null, null, config.onMap);
			core.maps._drawBgFgMap(floorId, 'fg', config);
			if (config.onMap) {
				core.drawImage(toDrawCtx, cacheCtx.canvas, core.bigmap.v2 ? -32 : 0, core.bigmap.v2 ? -32 : 0);
				core.clearMap('fg2');
				core.clearMap(cacheCtx);
			}
			core.maps._drawBgFgMap(floorId, 'fg2', config);
			if (config.onMap) core.drawImage('fg2', cacheCtx.canvas, core.bigmap.v2 ? -32 : 0, core.bigmap.v2 ? -32 : 0);
			config.ctx = toDrawCtx;
		}
		////// 移动判定 //////
		core.maps._generateMovableArray_arrays = function (floorId) {
			return {
				bgArray: this.getBgMapArray(floorId),
				fgArray: this.getFgMapArray(floorId),
				eventArray: this.getMapArray(floorId),
				bg2Array: this._getBgFgMapArray('bg2', floorId),
				fg2Array: this._getBgFgMapArray('fg2', floorId)
			};
		}
	},
	"itemShop": function () {
		// 道具商店相关的插件
		// 可在全塔属性-全局商店中使用「道具商店」事件块进行编辑（如果找不到可以在入口方块中找）

		var shopId = null; // 当前商店ID
		var type = 0; // 当前正在选中的类型，0买入1卖出
		var selectItem = 0; // 当前正在选中的道具
		var selectCount = 0; // 当前已经选中的数量
		var page = 0;
		var totalPage = 0;
		var totalMoney = 0;
		var list = [];
		var shopInfo = null; // 商店信息
		var choices = []; // 商店选项
		var use = 'money';
		var useText = '金币';

		var bigFont = core.ui._buildFont(20, false),
			middleFont = core.ui._buildFont(18, false);

		this._drawItemShop = function () {
			// 绘制道具商店

			// Step 1: 背景和固定的几个文字
			core.ui._createUIEvent();
			core.clearMap('uievent');
			core.ui.clearUIEventSelector();
			core.setTextAlign('uievent', 'left');
			core.setTextBaseline('uievent', 'top');
			core.fillRect('uievent', 0, 0, 416, 416, 'black');
			core.drawWindowSkin('winskin.png', 'uievent', 0, 0, 416, 56);
			core.drawWindowSkin('winskin.png', 'uievent', 0, 56, 312, 56);
			core.drawWindowSkin('winskin.png', 'uievent', 0, 112, 312, 304);
			core.drawWindowSkin('winskin.png', 'uievent', 312, 56, 104, 56);
			core.drawWindowSkin('winskin.png', 'uievent', 312, 112, 104, 304);
			core.setFillStyle('uievent', 'white');
			core.setStrokeStyle('uievent', 'white');
			core.fillText("uievent", "购买", 32, 74, 'white', bigFont);
			core.fillText("uievent", "卖出", 132, 74);
			core.fillText("uievent", "离开", 232, 74);
			core.fillText("uievent", "当前" + useText, 324, 66, null, middleFont);
			core.setTextAlign("uievent", "right");
			core.fillText("uievent", core.formatBigNumber(core.status.hero[use]), 405, 89);
			core.setTextAlign("uievent", "left");
			core.ui.drawUIEventSelector(1, "winskin.png", 22 + 100 * type, 66, 60, 33);
			if (selectItem != null) {
				core.setTextAlign('uievent', 'center');
				core.fillText("uievent", type == 0 ? "买入个数" : "卖出个数", 364, 320, null, bigFont);
				core.fillText("uievent", "<   " + selectCount + "   >", 364, 350);
				core.fillText("uievent", "确定", 364, 380);
			}

			// Step 2：获得列表并展示
			list = choices.filter(function (one) {
				if (one.condition != null && one.condition != '') {
					try { if (!core.calValue(one.condition)) return false; } catch (e) { }
				}
				return (type == 0 && one.money != null) || (type == 1 && one.sell != null);
			});
			var per_page = 6;
			totalPage = Math.ceil(list.length / per_page);
			page = Math.floor((selectItem || 0) / per_page) + 1;

			// 绘制分页
			if (totalPage > 1) {
				var half = 156;
				core.setTextAlign('uievent', 'center');
				core.fillText('uievent', page + " / " + totalPage, half, 388, null, middleFont);
				if (page > 1) core.fillText('uievent', '上一页', half - 80, 388);
				if (page < totalPage) core.fillText('uievent', '下一页', half + 80, 388);
			}
			core.setTextAlign('uievent', 'left');

			// 绘制每一项
			var start = (page - 1) * per_page;
			for (var i = 0; i < per_page; ++i) {
				var curr = start + i;
				if (curr >= list.length) break;
				var item = list[curr];
				core.drawIcon('uievent', item.id, 10, 125 + i * 40);
				core.setTextAlign('uievent', 'left');
				core.fillText('uievent', core.material.items[item.id].name, 50, 132 + i * 40, null, bigFont);
				core.setTextAlign('uievent', 'right');
				core.fillText('uievent', (type == 0 ? core.calValue(item.money) : core.calValue(item.sell)) + useText + "/个", 300, 133 + i * 40, null, middleFont);
				core.setTextAlign("uievent", "left");
				if (curr == selectItem) {
					// 绘制描述，文字自动放缩
					var text = core.material.items[item.id].text || "该道具暂无描述";
					try { text = core.replaceText(text); } catch (e) { }
					for (var fontSize = 20; fontSize >= 8; fontSize -= 2) {
						var config = { left: 10, fontSize: fontSize, maxWidth: 403 };
						var height = core.getTextContentHeight(text, config);
						if (height <= 50) {
							config.top = (56 - height) / 2;
							core.drawTextContent("uievent", text, config);
							break;
						}
					}
					core.ui.drawUIEventSelector(2, "winskin.png", 8, 120 + i * 40, 295, 40);
					if (type == 0 && item.number != null) {
						core.fillText("uievent", "存货", 324, 132, null, bigFont);
						core.setTextAlign("uievent", "right");
						core.fillText("uievent", item.number, 406, 132, null, null, 40);
					} else if (type == 1) {
						core.fillText("uievent", "数量", 324, 132, null, bigFont);
						core.setTextAlign("uievent", "right");
						core.fillText("uievent", core.itemCount(item.id), 406, 132, null, null, 40);
					}
					core.setTextAlign("uievent", "left");
					core.fillText("uievent", "预计" + useText, 324, 250);
					core.setTextAlign("uievent", "right");
					totalMoney = selectCount * (type == 0 ? core.calValue(item.money) : core.calValue(item.sell));
					core.fillText("uievent", core.formatBigNumber(totalMoney), 405, 280);

					core.setTextAlign("uievent", "left");
					core.fillText("uievent", type == 0 ? "已购次数" : "已卖次数", 324, 170);
					core.setTextAlign("uievent", "right");
					core.fillText("uievent", (type == 0 ? item.money_count : item.sell_count) || 0, 405, 200);
				}
			}

			core.setTextAlign('uievent', 'left');
			core.setTextBaseline('uievent', 'alphabetic');
		}

		var _add = function (item, delta) {
			if (item == null) return;
			selectCount = core.clamp(
				selectCount + delta, 0,
				Math.min(type == 0 ? Math.floor(core.status.hero[use] / core.calValue(item.money)) : core.itemCount(item.id),
					type == 0 && item.number != null ? item.number : Number.MAX_SAFE_INTEGER)
			);
		}

		var _confirm = function (item) {
			if (item == null || selectCount == 0) return;
			if (type == 0) {
				core.status.hero[use] -= totalMoney;
				core.getItem(item.id, selectCount);
				core.stopSound();
				core.playSound('确定');
				if (item.number != null) item.number -= selectCount;
				item.money_count = (item.money_count || 0) + selectCount;
			} else {
				core.status.hero[use] += totalMoney;
				core.removeItem(item.id, selectCount);
				core.playSound('确定');
				core.drawTip("成功卖出" + selectCount + "个" + core.material.items[item.id].name, item.id);
				if (item.number != null) item.number += selectCount;
				item.sell_count = (item.sell_count || 0) + selectCount;
			}
			selectCount = 0;
		}

		this._performItemShopKeyBoard = function (keycode) {
			var item = list[selectItem] || null;
			// 键盘操作
			switch (keycode) {
				case 38: // up
					if (selectItem == null) break;
					if (selectItem == 0) selectItem = null;
					else selectItem--;
					selectCount = 0;
					break;
				case 37: // left
					if (selectItem == null) {
						if (type > 0) type--;
						break;
					}
					_add(item, -1);
					break;
				case 39: // right
					if (selectItem == null) {
						if (type < 2) type++;
						break;
					}
					_add(item, 1);
					break;
				case 40: // down
					if (selectItem == null) {
						if (list.length > 0) selectItem = 0;
						break;
					}
					if (list.length == 0) break;
					selectItem = Math.min(selectItem + 1, list.length - 1);
					selectCount = 0;
					break;
				case 13:
				case 32: // Enter/Space
					if (selectItem == null) {
						if (type == 2)
							core.insertAction({ "type": "break" });
						else if (list.length > 0)
							selectItem = 0;
						break;
					}
					_confirm(item);
					break;
				case 27: // ESC
					if (selectItem == null) {
						core.insertAction({ "type": "break" });
						break;
					}
					selectItem = null;
					break;
			}
		}

		this._performItemShopClick = function (px, py) {
			var item = list[selectItem] || null;
			// 鼠标操作
			if (px >= 22 && px <= 82 && py >= 71 && py <= 102) {
				// 买
				if (type != 0) {
					type = 0;
					selectItem = null;
					selectCount = 0;
				}
				return;
			}
			if (px >= 122 && px <= 182 && py >= 71 && py <= 102) {
				// 卖
				if (type != 1) {
					type = 1;
					selectItem = null;
					selectCount = 0;
				}
				return;
			}
			if (px >= 222 && px <= 282 && py >= 71 && py <= 102) // 离开
				return core.insertAction({ "type": "break" });
			// < >
			if (px >= 318 && px <= 341 && py >= 348 && py <= 376)
				return _add(item, -1);
			if (px >= 388 && px <= 416 && py >= 348 && py <= 376)
				return _add(item, 1);
			// 确定
			if (px >= 341 && px <= 387 && py >= 380 && py <= 407)
				return _confirm(item);

			// 上一页/下一页
			if (px >= 45 && px <= 105 && py >= 388) {
				if (page > 1) {
					selectItem -= 6;
					selectCount = 0;
				}
				return;
			}
			if (px >= 208 && px <= 268 && py >= 388) {
				if (page < totalPage) {
					selectItem = Math.min(selectItem + 6, list.length - 1);
					selectCount = 0;
				}
				return;
			}

			// 实际区域
			if (px >= 9 && px <= 300 && py >= 120 && py < 360) {
				if (list.length == 0) return;
				var index = parseInt((py - 120) / 40);
				var newItem = 6 * (page - 1) + index;
				if (newItem >= list.length) newItem = list.length - 1;
				if (newItem != selectItem) {
					selectItem = newItem;
					selectCount = 0;
				}
				return;
			}
		}

		this._performItemShopAction = function () {
			if (flags.type == 0) return this._performItemShopKeyBoard(flags.keycode);
			else return this._performItemShopClick(flags.px, flags.py);
		}

		this.openItemShop = function (itemShopId) {
			shopId = itemShopId;
			type = 0;
			page = 0;
			selectItem = null;
			selectCount = 0;
			core.isShopVisited(itemShopId);
			shopInfo = flags.__shops__[shopId];
			if (shopInfo.choices == null) shopInfo.choices = core.clone(core.status.shops[shopId].choices);
			choices = shopInfo.choices;
			use = core.status.shops[shopId].use;
			if (use != 'exp') use = 'money';
			useText = use == 'money' ? '金币' : '经验';

			core.insertAction([{
				"type": "while",
				"condition": "true",
				"data": [
					{ "type": "function", "function": "function () { core.plugin._drawItemShop(); }" },
					{ "type": "wait" },
					{ "type": "function", "function": "function() { core.plugin._performItemShopAction(); }" }
				]
			},
			{
				"type": "function",
				"function": "function () { core.deleteCanvas('uievent'); core.ui.clearUIEventSelector(); }"
			}
			]);
		}

	},
	"enemyLevel": function () {
		// 此插件将提供怪物手册中的怪物境界显示
		// 使用此插件需要先给每个怪物定义境界，方法如下：
		// 点击怪物的【配置表格】，找到“【怪物】相关的表格配置”，然后在【名称】仿照增加境界定义：
		/*
		 "level": {
			  "_leaf": true,
			  "_type": "textarea",
			  "_string": true,
			  "_data": "境界"
		 },
		 */
		// 然后保存刷新，可以看到怪物的属性定义中出现了【境界】。再开启本插件即可。

		// 是否开启本插件，默认禁用；将此改成 true 将启用本插件。
		var __enable = false;
		if (!__enable) return;

		// 这里定义每个境界的显示颜色；可以写'red', '#RRGGBB' 或者[r,g,b,a]四元数组
		var levelToColors = {
			"萌新一阶": "red",
			"萌新二阶": "#FF0000",
			"萌新三阶": [255, 0, 0, 1],
		};

		// 复写 _drawBook_drawName
		var originDrawBook = core.ui._drawBook_drawName;
		core.ui._drawBook_drawName = function (index, enemy, top, left, width) {
			// 如果没有境界，则直接调用原始代码绘制
			if (!enemy.level) return originDrawBook.call(core.ui, index, enemy, top, left, width);
			// 存在境界，则额外进行绘制
			core.setTextAlign('ui', 'center');
			if (enemy.specialText.length == 0) {
				core.fillText('ui', enemy.name, left + width / 2,
					top + 27, '#DDDDDD', this._buildFont(17, true));
				core.fillText('ui', enemy.level, left + width / 2,
					top + 51, core.arrayToRGBA(levelToColors[enemy.level] || '#DDDDDD'), this._buildFont(14, true));
			} else {
				core.fillText('ui', enemy.name, left + width / 2,
					top + 20, '#DDDDDD', this._buildFont(17, true), width);
				switch (enemy.specialText.length) {
					case 1:
						core.fillText('ui', enemy.specialText[0], left + width / 2,
							top + 38, core.arrayToRGBA((enemy.specialColor || [])[0] || '#FF6A6A'),
							this._buildFont(14, true), width);
						break;
					case 2:
						// Step 1: 计算字体
						var text = enemy.specialText[0] + "  " + enemy.specialText[1];
						core.setFontForMaxWidth('ui', text, width, this._buildFont(14, true));
						// Step 2: 计算总宽度
						var totalWidth = core.calWidth('ui', text);
						var leftWidth = core.calWidth('ui', enemy.specialText[0]);
						var rightWidth = core.calWidth('ui', enemy.specialText[1]);
						// Step 3: 绘制
						core.fillText('ui', enemy.specialText[0], left + (width + leftWidth - totalWidth) / 2,
							top + 38, core.arrayToRGBA((enemy.specialColor || [])[0] || '#FF6A6A'));
						core.fillText('ui', enemy.specialText[1], left + (width + totalWidth - rightWidth) / 2,
							top + 38, core.arrayToRGBA((enemy.specialColor || [])[1] || '#FF6A6A'));
						break;
					default:
						core.fillText('ui', '多属性...', left + width / 2,
							top + 38, '#FF6A6A', this._buildFont(14, true), width);
				}
				core.fillText('ui', enemy.level, left + width / 2,
					top + 56, core.arrayToRGBA(levelToColors[enemy.level] || '#DDDDDD'), this._buildFont(14, true));
			}
		}

		// 也可以复写其他的属性颜色如怪物攻防等，具体参见下面的例子的注释部分
		core.ui._drawBook_drawRow1 = function (index, enemy, top, left, width, position) {
			// 绘制第一行
			core.setTextAlign('ui', 'left');
			var b13 = this._buildFont(13, true),
				f13 = this._buildFont(13, false);
			var col1 = left,
				col2 = left + width * 9 / 25,
				col3 = left + width * 17 / 25;
			core.fillText('ui', '生命', col1, position, '#DDDDDD', f13);
			core.fillText('ui', core.formatBigNumber(enemy.hp || 0), col1 + 30, position, /*'red' */ null, b13);
			core.fillText('ui', '攻击', col2, position, null, f13);
			core.fillText('ui', core.formatBigNumber(enemy.atk || 0), col2 + 30, position, /* '#FF0000' */ null, b13);
			core.fillText('ui', '防御', col3, position, null, f13);
			core.fillText('ui', core.formatBigNumber(enemy.def || 0), col3 + 30, position, /* [255, 0, 0, 1] */ null, b13);
		}


	},
	"multiHeros": function () {
		// 多角色插件
		// Step 1: 启用本插件
		// Step 2: 定义每个新的角色各项初始数据（参见下方注释）
		// Step 3: 在游戏中的任何地方都可以调用 `core.changeHero()` 进行切换；也可以 `core.changeHero(1)` 来切换到某个具体的角色上

		// 是否开启本插件，默认禁用；将此改成 true 将启用本插件。
		var __enable = false;
		if (!__enable) return;

		// 在这里定义全部的新角色属性
		// 请注意，在这里定义的内容不会多角色共用，在切换时会进行恢复。
		// 你也可以自行新增或删除，比如不共用金币则可以加上"money"的初始化，不共用道具则可以加上"items"的初始化，
		// 多角色共用hp的话则删除hp，等等。总之，不共用的属性都在这里进行定义就好。
		var hero1 = {
			"floorId": "MT0", // 该角色初始楼层ID；如果共用楼层可以注释此项
			"image": "brave.png", // 角色的行走图名称；此项必填不然会报错
			"name": "1号角色",
			"lv": 1,
			"hp": 10000, // 如果HP共用可注释此项
			"atk": 1000,
			"def": 1000,
			"mdef": 0,
			// "money": 0, // 如果要不共用金币则取消此项注释
			// "exp": 0, // 如果要不共用经验则取消此项注释
			"loc": { "x": 0, "y": 0, "direction": "up" }, // 该角色初始位置；如果共用位置可注释此项
			"items": {
				"tools": {}, // 如果共用消耗道具（含钥匙）则可注释此项
				// "constants": {}, // 如果不共用永久道具（如手册）可取消注释此项
				"equips": {}, // 如果共用在背包的装备可注释此项
			},
			"equipment": [], // 如果共用装备可注释此项；此项和上面的「共用在背包的装备」需要拥有相同状态，不然可能出现问题
		};
		// 也可以类似新增其他角色
		// 新增的角色，各项属性共用与不共用的选择必须和上面完全相同，否则可能出现问题。
		// var hero2 = { ...

		var heroCount = 2; // 包含默认角色在内总共多少个角色，该值需手动修改。

		this.initHeros = function () {
			core.setFlag("hero1", core.clone(hero1)); // 将属性值存到变量中
			// core.setFlag("hero2", core.clone(hero2)); // 更多的角色也存入变量中；每个定义的角色都需要新增一行

			// 检测是否存在装备
			if (hero1.equipment) {
				if (!hero1.items || !hero1.items.equips) {
					alert('多角色插件的equipment和道具中的equips必须拥有相同状态！');
				}
				// 存99号套装为全空
				var saveEquips = core.getFlag("saveEquips", []);
				saveEquips[99] = [];
				core.setFlag("saveEquips", saveEquips);
			} else {
				if (hero1.items && hero1.items.equips) {
					alert('多角色插件的equipment和道具中的equips必须拥有相同状态！');
				}
			}
		}

		// 在游戏开始注入initHeros
		var _startGame_setHard = core.events._startGame_setHard;
		core.events._startGame_setHard = function () {
			_startGame_setHard.call(core.events);
			core.initHeros();
		}

		// 切换角色
		// 可以使用 core.changeHero() 来切换到下一个角色
		// 也可以 core.changeHero(1) 来切换到某个角色（默认角色为0）
		this.changeHero = function (toHeroId) {
			var currHeroId = core.getFlag("heroId", 0); // 获得当前角色ID
			if (toHeroId == null) {
				toHeroId = (currHeroId + 1) % heroCount;
			}
			if (currHeroId == toHeroId) return;

			var saveList = Object.keys(hero1);

			// 保存当前内容
			var toSave = {};
			// 暂时干掉 drawTip 和 音效，避免切装时的提示
			var _drawTip = core.ui.drawTip;
			core.ui.drawTip = function () { };
			var _playSound = core.control.playSound;
			core.control.playSound = function () { }
			// 记录当前录像，因为可能存在换装问题
			core.clearRouteFolding();
			var routeLength = core.status.route.length;
			// 优先判定装备
			if (hero1.equipment) {
				core.items.quickSaveEquip(100 + currHeroId);
				core.items.quickLoadEquip(99);
			}

			saveList.forEach(function (name) {
				if (name == 'floorId') toSave[name] = core.status.floorId; // 楼层单独设置
				else if (name == 'items') {
					toSave.items = core.clone(core.status.hero.items);
					Object.keys(toSave.items).forEach(function (one) {
						if (!hero1.items[one]) delete toSave.items[one];
					});
				} else toSave[name] = core.clone(core.status.hero[name]); // 使用core.clone()来创建新对象
			});

			core.setFlag("hero" + currHeroId, toSave); // 将当前角色信息进行保存
			var data = core.getFlag("hero" + toHeroId); // 获得要切换的角色保存内容

			// 设置角色的属性值
			saveList.forEach(function (name) {
				if (name == "floorId");
				else if (name == "items") {
					Object.keys(core.status.hero.items).forEach(function (one) {
						if (data.items[one]) core.status.hero.items[one] = core.clone(data.items[one]);
					});
				} else {
					core.status.hero[name] = core.clone(data[name]);
				}
			});
			// 最后装上装备
			if (hero1.equipment) {
				core.items.quickLoadEquip(100 + toHeroId);
			}

			core.ui.drawTip = _drawTip;
			core.control.playSound = _playSound;
			core.status.route = core.status.route.slice(0, routeLength);
			core.control._bindRoutePush();

			// 插入事件：改变角色行走图并进行楼层切换
			var toFloorId = data.floorId || core.status.floorId;
			var toLoc = data.loc || core.status.hero.loc;
			core.insertAction([
				{ "type": "setHeroIcon", "name": data.image || "hero.png" }, // 改变行走图
				// 同层则用changePos，不同层则用changeFloor；这是为了避免共用楼层造成触发eachArrive
				toFloorId != core.status.floorId ? {
					"type": "changeFloor",
					"floorId": toFloorId,
					"loc": [toLoc.x, toLoc.y],
					"direction": toLoc.direction,
					"time": 0 // 可以在这里设置切换时间
				} : { "type": "changePos", "loc": [toLoc.x, toLoc.y], "direction": toLoc.direction }
				// 你还可以在这里执行其他事件，比如增加或取消跟随效果
			]);
			core.setFlag("heroId", toHeroId); // 保存切换到的角色ID
		}
	},
	"heroFourFrames": function () {
		// 样板的勇士/跟随者移动时只使用2、4两帧，观感较差。本插件可以将四帧全用上。

		// 是否启用本插件
		var __enable = false;
		if (!__enable) return;

		["up", "down", "left", "right"].forEach(function (one) {
			// 指定中间帧动画
			core.material.icons.hero[one].midFoot = 2;
		});

		var heroMoving = function (timestamp) {
			if (core.status.heroMoving <= 0) return;
			if (timestamp - core.animateFrame.moveTime > core.values.moveSpeed) {
				core.animateFrame.leftLeg++;
				core.animateFrame.moveTime = timestamp;
			}
			core.drawHero(['stop', 'leftFoot', 'midFoot', 'rightFoot'][core.animateFrame.leftLeg % 4], 4 * core.status.heroMoving);
		}
		core.registerAnimationFrame('heroMoving', true, heroMoving);

		core.events._eventMoveHero_moving = function (step, moveSteps) {
			var curr = moveSteps[0];
			var direction = curr[0], x = core.getHeroLoc('x'), y = core.getHeroLoc('y');
			// ------ 前进/后退
			var o = direction == 'backward' ? -1 : 1;
			if (direction == 'forward' || direction == 'backward') direction = core.getHeroLoc('direction');
			var faceDirection = direction;
			if (direction == 'leftup' || direction == 'leftdown') faceDirection = 'left';
			if (direction == 'rightup' || direction == 'rightdown') faceDirection = 'right';
			core.setHeroLoc('direction', direction);
			if (curr[1] <= 0) {
				core.setHeroLoc('direction', faceDirection);
				moveSteps.shift();
				return true;
			}
			if (step <= 4) core.drawHero('stop', 4 * o * step);
			else if (step <= 8) core.drawHero('leftFoot', 4 * o * step);
			else if (step <= 12) core.drawHero('midFoot', 4 * o * (step - 8));
			else if (step <= 16) core.drawHero('rightFoot', 4 * o * (step - 8)); // if (step == 8) {
			if (step == 8 || step == 16) {
				core.setHeroLoc('x', x + o * core.utils.scan2[direction].x, true);
				core.setHeroLoc('y', y + o * core.utils.scan2[direction].y, true);
				core.updateFollowers();
				curr[1]--;
				if (curr[1] <= 0) moveSteps.shift();
				core.setHeroLoc('direction', faceDirection);
				return step == 16;
			}
			return false;
		}
	},
	"startCanvas": function () {
		// 使用本插件可以将自绘的标题界面居中。仅在【标题开启事件化】后才有效。
		// 由于一些技术性的原因，标题界面事件化无法应用到覆盖状态栏的整个界面。
		// 这是一个较为妥协的插件，会在自绘标题界面时隐藏状态栏、工具栏和边框，并将画布进行居中。
		// 本插件仅在全塔属性的 "startCanvas" 生效；进入 "startText" 时将会离开居中状态，回归正常界面。

		// 是否开启本插件，默认禁用；将此改成 true 将启用本插件。
		var __enable = false;
		if (!__enable) return;

		// 检查【标题开启事件化】是否开启
		if (!core.flags.startUsingCanvas || main.mode != 'play') return;

		var _isTitleCanvasEnabled = false;
		var _getClickLoc = core.actions._getClickLoc;
		this._setTitleCanvas = function () {
			if (_isTitleCanvasEnabled) return;
			_isTitleCanvasEnabled = true;

			// 禁用窗口resize
			window.onresize = function () { };
			core.resize = function () { }

			// 隐藏状态栏
			core.dom.statusBar.style.display = 'none';
			core.dom.statusCanvas.style.display = 'none';
			core.dom.toolBar.style.display = 'none';
			// 居中画布
			if (core.domStyle.isVertical) {
				core.dom.gameDraw.style.top =
					(parseInt(core.dom.gameGroup.style.height) - parseInt(core.dom.gameDraw.style.height)) / 2 + "px";
			} else {
				core.dom.gameDraw.style.right =
					(parseInt(core.dom.gameGroup.style.width) - parseInt(core.dom.gameDraw.style.width)) / 2 + "px";
			}
			core.dom.gameDraw.style.border = '3px transparent solid';
			core.actions._getClickLoc = function (x, y) {
				var left = core.dom.gameGroup.offsetLeft + core.dom.gameDraw.offsetLeft + 3;
				var top = core.dom.gameGroup.offsetTop + core.dom.gameDraw.offsetTop + 3;
				var loc = { 'x': Math.max(x - left, 0), 'y': Math.max(y - top, 0), 'size': 32 * core.domStyle.scale };
				return loc;
			}
		}

		this._resetTitleCanvas = function () {
			if (!_isTitleCanvasEnabled) return;
			_isTitleCanvasEnabled = false;
			window.onresize = function () { try { main.core.resize(); } catch (ee) { console.error(ee) } }
			core.resize = function () { return core.control.resize(); }
			core.resize();
			core.actions._getClickLoc = _getClickLoc;
		}

		// 复写“开始游戏”
		core.events._startGame_start = function (hard, seed, route, callback) {
			console.log('开始游戏');
			core.resetGame(core.firstData.hero, hard, null, core.cloneArray(core.initStatus.maps));
			core.setHeroLoc('x', -1);
			core.setHeroLoc('y', -1);

			if (seed != null) {
				core.setFlag('__seed__', seed);
				core.setFlag('__rand__', seed);
			} else core.utils.__init_seed();

			core.clearStatusBar();
			core.plugin._setTitleCanvas();

			var todo = [];
			core.hideStatusBar();
			core.push(todo, core.firstData.startCanvas);
			core.push(todo, { "type": "function", "function": "function() { core.plugin._resetTitleCanvas(); core.events._startGame_setHard(); }" })
			core.push(todo, core.firstData.startText);
			this.insertAction(todo, null, null, function () {
				core.events._startGame_afterStart(callback);
			});

			if (route != null) core.startReplay(route);
		}

		var _loadData = core.control.loadData;
		core.control.loadData = function (data, callback) {
			core.plugin._resetTitleCanvas();
			_loadData.call(core.control, data, callback);
		}
	},
	"advancedAnimation": function () {
		// -------------------- 插件说明 -------------------- //
		// github仓库：https://github.com/unanmed/animate
		// npm包名：mutate-animate
		// npm地址：https://www.npmjs.com/package/mutate-animate

		// 是否开启本插件，默认启用；将此改成 false 将禁用本插件。
		var __enable = true;

		if (main.replayChecking) __enable = false;
		if (!__enable) {
			core.plugin.animate = {};
			this.deleteTicker = () => { };
			this.deleteAllTickers = () => { };
			this.getAllTickers = () => { };
			return;
		}

		// 保存所有Ticker的引用
		const tickersMap = new Map();

		/** 摧毁指定名字的ticker */
		this.deleteTicker = function (name) {
			const ticker = tickersMap.get(name);
			if (!ticker) return;
			ticker.destroy();
			tickersMap.delete(name);
		}

		/** 摧毁所有有名字的ticker */
		this.deleteAllTickers = function () {
			tickersMap.forEach((ticker) => {
				if (!ticker) return;
				ticker.destroy();
			})
			tickersMap.clear();
		}

		this.getAllTickers = () => tickersMap;

		var M = Object.defineProperty;
		var E = (n, i, t) => i in n ? M(n, i, { enumerable: !0, configurable: !0, writable: !0, value: t }) : n[i] = t;
		var o = (n, i, t) => (E(n, typeof i != "symbol" ? i + "" : i, t), t);
		let w = [];
		const k = (n) => {
			for (const i of w)
				if (i.status === "running")
					try {
						for (const t of i.funcs)
							t(n - i.startTime);
					} catch (t) {
						i.destroy(), console.error(t);
					}
			requestAnimationFrame(k);
		};
		requestAnimationFrame(k);
		class I {
			constructor() {
				o(this, "funcs", /* @__PURE__ */ new Set());
				o(this, "status", "stop");
				o(this, "startTime", 0);
				this.status = "running", w.push(this), requestAnimationFrame((i) => this.startTime = i);
			}
			add(i) {
				return this.funcs.add(i), this;
			}
			remove(i) {
				return this.funcs.delete(i), this;
			}
			clear() {
				this.funcs.clear();
			}
			destroy() {
				this.clear(), this.stop();
			}
			stop() {
				this.status = "stop", w = w.filter((i) => i !== this);
			}
		}
		// F is Ticker
		class F {
			constructor(name) {
				o(this, "timing");
				o(this, "relation", "absolute");
				o(this, "easeTime", 0);
				o(this, "applying", {});
				o(this, "getTime", Date.now);
				const ticker = new I();
				o(this, "ticker", ticker);
				o(this, "value", {});
				o(this, "listener", {});
				this.timing = (i) => i;
				if (typeof name === 'string') tickersMap.set(name, ticker);
			}
			async all() {
				if (Object.values(this.applying).every((i) => i === !0))
					throw new ReferenceError("There is no animates to be waited.");
				await new Promise((i) => {
					const t = () => {
						Object.values(this.applying).every((e) => e === !1) && (this.unlisten("end", t), i("all animated."));
					};
					this.listen("end", t);
				});
			}
			async n(i) {
				const t = Object.values(this.applying).filter((s) => s === !0).length;
				if (t < i)
					throw new ReferenceError(
						`You are trying to wait ${i} animate, but there are only ${t} animate animating.`
					);
				let e = 0;
				await new Promise((s) => {
					const r = () => {
						e++, e === i && (this.unlisten("end", r), s(`${i} animated.`));
					};
					this.listen("end", r);
				});
			}
			async w(i) {
				if (this.applying[i] === !1)
					throw new ReferenceError(`The ${i} animate is not animating.`);
				await new Promise((t) => {
					const e = () => {
						this.applying[i] === !1 && (this.unlisten("end", e), t(`${i} animated.`));
					};
					this.listen("end", e);
				});
			}
			listen(i, t) {
				var e, s;
				(s = (e = this.listener)[i]) != null || (e[i] = []), this.listener[i].push(t);
			}
			unlisten(i, t) {
				const e = this.listener[i].findIndex((s) => s === t);
				if (e === -1)
					throw new ReferenceError(
						"You are trying to remove a nonexistent listener."
					);
				this.listener[i].splice(e, 1);
			}
			hook(...i) {
				const t = Object.entries(this.listener).filter(
					(e) => i.includes(e[0])
				);
				for (const [e, s] of t)
					for (const r of s)
						r(this, e);
			}
		}

		function y(n) {
			return n != null;
		}
		async function R(n) {
			return new Promise((i) => setTimeout(i, n));
		}
		// j is Animation
		class j extends F {
			constructor(name) {
				super(name);
				o(this, "shakeTiming");
				o(this, "path");
				o(this, "multiTiming");
				o(this, "value", {});
				o(this, "size", 1);
				o(this, "angle", 0);
				o(this, "targetValue", {
					system: {
						move: [0, 0],
						moveAs: [0, 0],
						resize: 0,
						rotate: 0,
						shake: 0,
						"@@bind": []
					},
					custom: {}
				});
				o(this, "animateFn", {
					system: {
						move: [() => 0, () => 0],
						moveAs: () => 0,
						resize: () => 0,
						rotate: () => 0,
						shake: () => 0,
						"@@bind": () => 0
					},
					custom: {}
				});
				o(this, "ox", 0);
				o(this, "oy", 0);
				o(this, "sx", 0);
				o(this, "sy", 0);
				o(this, "bindInfo", []);
				this.timing = (t) => t, this.shakeTiming = (t) => t, this.multiTiming = (t) => [t, t], this.path = (t) => [t, t], this.applying = {
					move: !1,
					scale: !1,
					rotate: !1,
					shake: !1
				}, this.ticker.add(() => {
					const { running: t } = this.listener;
					if (y(t))
						for (const e of t)
							e(this, "running");
				});
			}
			get x() {
				return this.ox + this.sx;
			}
			get y() {
				return this.oy + this.sy;
			}
			mode(t, e = !1) {
				return typeof t(0) == "number" ? e ? this.shakeTiming = t : this.timing = t : this.multiTiming = t, this;
			}
			time(t) {
				return this.easeTime = t, this;
			}
			relative() {
				return this.relation = "relative", this;
			}
			absolute() {
				return this.relation = "absolute", this;
			}
			bind(...t) {
				return this.applying["@@bind"] === !0 && this.end(!1, "@@bind"), this.bindInfo = t, this;
			}
			unbind() {
				return this.applying["@@bind"] === !0 && this.end(!1, "@@bind"), this.bindInfo = [], this;
			}
			move(t, e) {
				return this.applying.move && this.end(!0, "move"), this.applySys("ox", t, "move"), this.applySys("oy", e, "move"), this;
			}
			rotate(t) {
				return this.applySys("angle", t, "rotate"), this;
			}
			scale(t) {
				return this.applySys("size", t, "resize"), this;
			}
			shake(t, e) {
				this.applying.shake === !0 && this.end(!0, "shake"), this.applying.shake = !0;
				const { easeTime: s, shakeTiming: r } = this, l = this.getTime();
				if (this.hook("start", "shakestart"), s <= 0)
					return this.end(!1, "shake"), this;
				const a = () => {
					const c = this.getTime() - l;
					if (c > s) {
						this.ticker.remove(a), this.applying.shake = !1, this.sx = 0, this.sy = 0, this.hook("end", "shakeend");
						return;
					}
					const h = c / s,
						m = r(h);
					this.sx = m * t, this.sy = m * e;
				};
				return this.ticker.add(a), this.animateFn.system.shake = a, this;
			}
			moveAs(t) {
				this.applying.moveAs && this.end(!0, "moveAs"), this.applying.moveAs = !0, this.path = t;
				const { easeTime: e, relation: s, timing: r } = this, l = this.getTime(), [a, u] = [this.x, this.y], [c, h] = (() => {
					if (s === "absolute")
						return t(1); {
						const [d, f] = t(1);
						return [a + d, u + f];
					}
				})();
				if (this.hook("start", "movestart"), e <= 0)
					return this.end(!1, "moveAs"), this;
				const m = () => {
					const f = this.getTime() - l;
					if (f > e) {
						this.end(!0, "moveAs");
						return;
					}
					const g = f / e,
						[v, x] = t(r(g));
					s === "absolute" ? (this.ox = v, this.oy = x) : (this.ox = a + v, this.oy = u + x);
				};
				return this.ticker.add(m), this.animateFn.system.moveAs = m, this.targetValue.system.moveAs = [c, h], this;
			}
			register(t, e) {
				if (typeof this.value[t] == "number")
					return this.error(
						`Property ${t} has been regietered twice.`,
						"reregister"
					);
				this.value[t] = e, this.applying[t] = !1;
			}
			apply(t, e) {
				this.applying[t] === !0 && this.end(!1, t), t in this.value || this.error(
					`You are trying to execute nonexistent property ${t}.`
				), this.applying[t] = !0;
				const s = this.value[t],
					r = this.getTime(),
					{ timing: l, relation: a, easeTime: u } = this,
					c = a === "absolute" ? e - s : e;
				if (this.hook("start"), u <= 0)
					return this.end(!1, t), this;
				const h = () => {
					const d = this.getTime() - r;
					if (d > u) {
						this.end(!1, t);
						return;
					}
					const f = d / u,
						g = l(f);
					this.value[t] = s + g * c;
				};
				return this.ticker.add(h), this.animateFn.custom[t] = h, this.targetValue.custom[t] = c + s, this;
			}
			applyMulti() {
				this.applying["@@bind"] === !0 && this.end(!1, "@@bind"), this.applying["@@bind"] = !0;
				const t = this.bindInfo,
					e = t.map((h) => this.value[h]),
					s = this.getTime(),
					{ multiTiming: r, relation: l, easeTime: a } = this,
					u = r(1);
				if (u.length !== e.length)
					throw new TypeError(
						`The number of binded animate attributes and timing function returns's length does not match. binded: ${t.length}, timing: ${u.length}`
					);
				if (this.hook("start"), a <= 0)
					return this.end(!1, "@@bind"), this;
				const c = () => {
					const m = this.getTime() - s;
					if (m > a) {
						this.end(!1, "@@bind");
						return;
					}
					const d = m / a,
						f = r(d);
					t.forEach((g, v) => {
						l === "absolute" ? this.value[g] = f[v] : this.value[g] = e[v] + f[v];
					});
				};
				return this.ticker.add(c), this.animateFn.custom["@@bind"] = c, this.targetValue.system["@@bind"] = u, this;
			}
			applySys(t, e, s) {
				s !== "move" && this.applying[s] === !0 && this.end(!0, s), this.applying[s] = !0;
				const r = this[t],
					l = this.getTime(),
					a = this.timing,
					u = this.relation,
					c = this.easeTime,
					h = u === "absolute" ? e - r : e;
				if (this.hook("start", `${s}start`), c <= 0)
					return this.end(!0, s);
				const m = () => {
					const f = this.getTime() - l;
					if (f > c) {
						this.end(!0, s);
						return;
					}
					const g = f / c,
						v = a(g);
					this[t] = r + h * v, t !== "oy" && this.hook(s);
				};
				this.ticker.add(m), t === "ox" ? this.animateFn.system.move[0] = m : t === "oy" ? this.animateFn.system.move[1] = m : this.animateFn.system[s] = m, s === "move" ? (t === "ox" && (this.targetValue.system.move[0] = h + r), t === "oy" && (this.targetValue.system.move[1] = h + r)) : s !== "shake" && (this.targetValue.system[s] = h + r);
			}
			error(t, e) {
				throw e === "repeat" ? new Error(
					`Cannot execute the same animation twice. Info: ${t}`
				) : e === "reregister" ? new Error(
					`Cannot register an animated property twice. Info: ${t}`
				) : new Error(t);
			}
			end(t, e) {
				if (t === !0)
					if (this.applying[e] = !1, e === "move" ? (this.ticker.remove(this.animateFn.system.move[0]), this.ticker.remove(this.animateFn.system.move[1])) : e === "moveAs" ? this.ticker.remove(this.animateFn.system.moveAs) : e === "@@bind" ? this.ticker.remove(this.animateFn.system["@@bind"]) : this.ticker.remove(
						this.animateFn.system[e]
					), e === "move") {
						const [s, r] = this.targetValue.system.move;
						this.ox = s, this.oy = r, this.hook("moveend", "end");
					} else if (e === "moveAs") {
						const [s, r] = this.targetValue.system.moveAs;
						this.ox = s, this.oy = r, this.hook("moveend", "end");
					} else
						e === "rotate" ? (this.angle = this.targetValue.system.rotate, this.hook("rotateend", "end")) : e === "resize" ? (this.size = this.targetValue.system.resize, this.hook("resizeend", "end")) : e === "@@bind" ? this.bindInfo.forEach((r, l) => {
							this.value[r] = this.targetValue.system["@@bind"][l];
						}) : (this.sx = 0, this.sy = 0, this.hook("shakeend", "end"));
				else
					this.applying[e] = !1, this.ticker.remove(this.animateFn.custom[e]), this.value[e] = this.targetValue.custom[e], this.hook("end");
			}
		}
		class O extends F {
			constructor() {
				super();
				o(this, "now", {});
				o(this, "target", {});
				o(this, "transitionFn", {});
				o(this, "value");
				o(this, "handleSet", (t, e, s) => (this.transition(e, s), !0));
				o(this, "handleGet", (t, e) => this.now[e]);
				this.timing = (t) => t, this.value = new Proxy(this.target, {
					set: this.handleSet,
					get: this.handleGet
				});
			}
			mode(t) {
				return this.timing = t, this;
			}
			time(t) {
				return this.easeTime = t, this;
			}
			relative() {
				return this.relation = "relative", this;
			}
			absolute() {
				return this.relation = "absolute", this;
			}
			transition(t, e) {
				if (e === this.target[t])
					return this;
				if (!y(this.now[t]))
					return this.now[t] = e, this;
				this.applying[t] && this.end(t, !0), this.applying[t] = !0, this.hook("start");
				const s = this.getTime(),
					r = this.easeTime,
					l = this.timing,
					a = this.now[t],
					u = e + (this.relation === "absolute" ? 0 : a),
					c = u - a;
				this.target[t] = u;
				const h = () => {
					const d = this.getTime() - s;
					if (d >= r) {
						this.end(t);
						return;
					}
					const f = d / r;
					this.now[t] = l(f) * c + a, this.hook("running");
				};
				return this.transitionFn[t] = h, this.ticker.add(h), r <= 0 ? (this.end(t), this) : this;
			}
			end(t, e = !1) {
				const s = this.transitionFn[t];
				if (!y(s))
					throw new ReferenceError(
						`You are trying to end an ended transition: ${t}`
					);
				this.ticker.remove(this.transitionFn[t]), delete this.transitionFn[t], this.applying[t] = !1, this.hook("end"), e || (this.now[t] = this.target[t]);
			}
		}
		const T = (...n) => n.reduce((i, t) => i + t, 0),
			b = (n) => {
				if (n === 0)
					return 1;
				let i = n;
				for (; n > 1;)
					n--, i *= n;
				return i;
			},
			A = (n, i) => Math.round(b(i) / (b(n) * b(i - n))),
			p = (n, i, t = (e) => 1 - i(1 - e)) => n === "in" ? i : n === "out" ? t : n === "in-out" ? (e) => e < 0.5 ? i(e * 2) / 2 : 0.5 + t((e - 0.5) * 2) / 2 : (e) => e < 0.5 ? t(e * 2) / 2 : 0.5 + i((e - 0.5) * 2) / 2,
			$ = Math.cosh(2),
			z = Math.acosh(2),
			V = Math.tanh(3),
			P = Math.atan(5);

		function Y() {
			return (n) => n;
		}

		function q(...n) {
			const i = [0].concat(n);
			i.push(1);
			const t = i.length,
				e = Array(t).fill(0).map((s, r) => A(r, t - 1));
			return (s) => {
				const r = e.map((l, a) => l * i[a] * (1 - s) ** (t - a - 1) * s ** a);
				return T(...r);
			};
		}

		function U(n, i) {
			if (n === "sin") {
				const t = (s) => Math.sin(s * Math.PI / 2);
				return p(i, (s) => 1 - t(1 - s), t);
			}
			if (n === "sec") {
				const t = (s) => 1 / Math.cos(s);
				return p(i, (s) => t(s * Math.PI / 3) - 1);
			}
			throw new TypeError(
				"Unexpected parameters are delivered in trigo timing function."
			);
		}

		function C(n, i) {
			if (!Number.isInteger(n))
				throw new TypeError(
					"The first parameter of power timing function only allow integer."
				);
			return p(i, (e) => e ** n);
		}

		function G(n, i) {
			if (n === "sin")
				return p(i, (e) => (Math.cosh(e * 2) - 1) / ($ - 1));
			if (n === "tan") {
				const t = (s) => Math.tanh(s * 3) * 1 / V;
				return p(i, (s) => 1 - t(1 - s), t);
			}
			if (n === "sec") {
				const t = (s) => 1 / Math.cosh(s);
				return p(i, (s) => 1 - (t(s * z) - 0.5) * 2);
			}
			throw new TypeError(
				"Unexpected parameters are delivered in hyper timing function."
			);
		}

		function N(n, i) {
			if (n === "sin") {
				const t = (s) => Math.asin(s) / Math.PI * 2;
				return p(i, (s) => 1 - t(1 - s), t);
			}
			if (n === "tan") {
				const t = (s) => Math.atan(s * 5) / P;
				return p(i, (s) => 1 - t(1 - s), t);
			}
			throw new TypeError(
				"Unexpected parameters are delivered in inverse trigo timing function."
			);
		}

		function B(n, i = () => 1) {
			let t = -1;
			return (e) => (t *= -1, e < 0.5 ? n * i(e * 2) * t : n * i((1 - e) * 2) * t);
		}

		function D(n, i = 1, t = [0, 0], e = 0, s = (l) => 1, r = !1) {
			return (l) => {
				const a = i * l * Math.PI * 2 + e * Math.PI / 180,
					u = Math.cos(a),
					c = Math.sin(a),
					h = n * s(s(r ? 1 - l : l));
				return [h * u + t[0], h * c + t[1]];
			};
		}

		function H(n, i, ...t) {
			const e = [n].concat(t);
			e.push(i);
			const s = e.length,
				r = Array(s).fill(0).map((l, a) => A(a, s - 1));
			return (l) => {
				const a = r.map((c, h) => c * e[h][0] * (1 - l) ** (s - h - 1) * l ** h),
					u = r.map((c, h) => c * e[h][1] * (1 - l) ** (s - h - 1) * l ** h);
				return [T(...a), T(...u)];
			};
		}

		core.plugin.animate = {
			Animation: j,
			AnimationBase: F,
			Ticker: I,
			Transition: O,
			bezier: q,
			bezierPath: H,
			circle: D,
			hyper: G,
			inverseTrigo: N,
			linear: Y,
			power: C,
			shake: B,
			sleep: R,
			trigo: U,
		}

	},
	"drawItemDetail": function () {
		/* 宝石血瓶左下角显示数值
			 * 需要将 变量：itemDetail改为true才可正常运行
			 * 请尽量减少勇士的属性数量，否则可能会出现严重卡顿（划掉，现在你放一万个属性也不会卡）
		 * 注意：这里的属性必须是core.status.hero里面的，flag无法显示
			 * 如果不想显示，可以core.setFlag("itemDetail", false);
		 * 然后再core.getItemDetail();
		 * 如有bug在大群或造塔群@古祠
		 */

		// 忽略的道具
		const ignore = ['superPotion'];

		// 取消注释下面这句可以减少超大地图的判定。
		// 如果地图宝石过多，可能会略有卡顿，可以尝试取消注释下面这句话来解决。
		// core.bigmap.threshold = 256;
		const origin = core.control.updateStatusBar;
		core.updateStatusBar = core.control.updateStatusBar = function () {
			if (core.getFlag('__statistics__')) return;
			else return origin.apply(core.control, arguments);
		}

		core.control.updateDamage = function (floorId, ctx) {
			floorId = floorId || core.status.floorId;
			if (!floorId || core.status.gameOver || main.mode != 'play') return;
			const onMap = ctx == null;

			// 没有怪物手册
			if (!core.hasItem('book')) return;
			core.status.damage.posX = core.bigmap.posX;
			core.status.damage.posY = core.bigmap.posY;
			if (!onMap) {
				const width = core.floors[floorId].width,
					height = core.floors[floorId].height;
				// 地图过大的缩略图不绘制显伤
				if (width * height > core.bigmap.threshold) return;
			}
			this._updateDamage_damage(floorId, onMap);
			this._updateDamage_extraDamage(floorId, onMap);
			if (core.status.thisMap) core.getItemDetail(floorId); // 宝石血瓶详细信息
			this.drawDamage(ctx);
		};

		function getRatio() {
			let ratio = core.status.thisMap.ratio;
			if (!core.isset(ratio)) ratio = 1;
			const currEvent = core.status.event;
			if (!currEvent) return ratio;
			switch (currEvent.id) {
				case 'viewMaps': //调整浏览地图时的倍率
					if (currEvent.data) {
						const viewMapFloorId = (currEvent.data.floorId);
						ratio = core.status.maps[viewMapFloorId].ratio;
					}
					break;
				case 'fly': //调整在楼传界面浏览地图时的倍率
					ratio = core.status.maps[core.floorIds[currEvent.data]].ratio;
					break;
			}
			return ratio;
		}

		// 获取宝石信息 并绘制
		this.getItemDetail = function (floorId) {
			if (!core.getFlag('itemDetail')) return;
			if (!core.status.thisMap) return;
			floorId = floorId ?? core.status.thisMap.floorId;
			const beforeRatio = core.status.thisMap.ratio;
			core.status.thisMap.ratio = core.status.maps[floorId].ratio;
			let diff = {};
			const before = core.status.hero;
			const hero = core.clone(core.status.hero);
			const handler = {
				set(target, key, v) {
					diff[key] = v - (target[key] || 0);
					if (!diff[key]) diff[key] = void 0;
					return true;
				}
			};
			core.status.hero = new Proxy(hero, handler);
			core.status.maps[floorId].blocks.forEach(function (block) {
				if (
					block.event.cls !== 'items' ||
					ignore.includes(block.event.id) ||
					block.disable
				)
					return;
				const x = block.x,
					y = block.y;
				// v2优化，只绘制范围内的部分
				if (core.bigmap.v2) {
					if (
						x < core.bigmap.posX - core.bigmap.extend ||
						x > core.bigmap.posX + core.__SIZE__ + core.bigmap.extend ||
						y < core.bigmap.posY - core.bigmap.extend ||
						y > core.bigmap.posY + core.__SIZE__ + core.bigmap.extend
					) {
						return;
					}
				}
				diff = {};
				const id = block.event.id;
				const item = core.material.items[id];
				if (item.cls === 'items' && item.hasOwnProperty('itemEffectEvent') && item.itemEffectEvent.hasOwnProperty('value')) {
					const values = item.itemEffectEvent.value;
					for (let statusName in values) {
						const getStatusValue = values[statusName];
						let ratio, needRatio, statusValue;
						if (statusName.endsWith(':o')) {
							needRatio = true;
							statusName = statusName.slice(0, -2);
						}
						ratio = getRatio();
						if (core.status.hero.hasOwnProperty(statusName)) {
							if (!diff.hasOwnProperty(statusName)) {
								diff[statusName] = 0;
							}
							try {
								statusValue = eval(getStatusValue);
							} catch (error) {
								console.log(error);
							}
							if (needRatio) statusValue *= ratio;
							diff[statusName] += statusValue || 0;
						}
					}
				}
				if (item.cls === 'equips') {
					// 装备也显示
					const diff = item.equip.value ?? {};
					const per = item.equip.percentage ?? {};
					for (const name in per) {
						diff[name + 'per'] = per[name].toString() + '%';
					}
					drawItemDetail(diff, x, y);
					return;
				}
				// 跟数据统计原理一样 执行效果 前后比较
				core.setFlag('__statistics__', true);
				try {
					eval(item.itemEffect);
				} catch (error) { }
				drawItemDetail(diff, x, y);
			});
			core.status.thisMap.ratio = beforeRatio;
			core.status.hero = before;
			window.hero = before;
			window.flags = before.flags;
		};

		// 绘制
		function drawItemDetail(diff, x, y) {
			const px = 32 * x + 2,
				py = 32 * y + 30;
			let content = '';
			// 获得数据和颜色
			let i = 0;
			for (const name in diff) {
				if (!diff[name]) continue;
				let color = '#fff';

				if (typeof diff[name] === 'number')
					content = core.formatBigNumber(diff[name], true);
				else content = diff[name];
				switch (name) {
					case 'atk':
					case 'atkper':
						color = ' #FF7A7A';
						break;
					case 'def':
					case 'defper':
						color = ' #00E6F1';
						break;
					case 'mdef':
					case 'mdefper':
						color = ' #6EFF83';
						break;
					case 'hp':
						color = ' #A4FF00';
						break;
					case 'hpmax':
					case 'hpmaxper':
						color = ' #F9FF00';
						break;
					case 'mana':
					case 'manamax':
						color = ' #CC6666';
						break;
				}
				// 绘制
				core.status.damage.data.push({
					text: content,
					px: px,
					py: py - 10 * i,
					color: color
				});
				i++;
			}
		}
	},
	"autoClear": function () {
		// 在此增加新插件
		/**
		 * --------------- 使用说明 ---------------
		 * 变量autoGet控制自动拾取开关
		 * 变量autoBattle控制自动清怪开关
		 */

		const { Transition, hyper, Ticker } = core.plugin.animate ?? {};

		// 磁吸特效的时长，单位毫秒
		const transitionTime = 600;

		const transitionList = [];

		const ctxName = 'globalAnimate';

		if (Ticker) {
			const ticker = new Ticker();
			ticker.add(() => {
				if (core.isReplaying()) return;
				const ctx = core.getContextByName(ctxName);
				if (!has(ctx)) return;
				core.clearMap(ctx);
			});
		}

		// 每走一步后自动拾取的判定要放在阻击结算之后

		control.prototype.moveDirectly = function (destX, destY, ignoreSteps) {
			const res = this.controldata.moveDirectly(
				destX,
				destY,
				ignoreSteps
			);
			core.control.updateCheckBlock();
			core.plugin.autoClear();
			return res;
		};

		this.autoClear = function () {
			auto();
			if (core.isReplaying()) return;
			for (let i = 0; i < transitionList.length; i++) {
				const t = transitionList[i];
				let { x, y } = core.status.hero.loc;
				t.value.x = x * 32 - core.bigmap.offsetX;
				t.value.y = y * 32 - core.bigmap.offsetY;
			}
		}

		function willLvUp(exp) {
			const nextExp = core.getNextLvUpNeed();
			if (typeof exp === 'number' && typeof nextExp === 'number' && exp >= nextExp) return true;
			return false;
		}

		/**
		 * 是否清这个怪，可以修改这里来实现对不同怪的不同操作
		 * @param {string} enemy
		 * @param {number} x
		 * @param {number} y
		 */
		function canBattle(enemy, x, y) {
			const loc = `${x},${y}`;
			const floor = core.floors[core.status.floorId];
			const e = core.getEnemyValue(enemy, null, x, y);
			const hasEvent =
				has(floor.afterBattle[loc]) || has(floor.beforeBattle[loc])
				|| has(e.beforeBattle) || has(e.afterBattle)
				|| has(floor.events[loc]) || willLvUp(e.exp); // 防止有升级后事件

			// 有事件，不清
			if (hasEvent) return false;
			// 有特定特殊属性的怪不清
			if (core.hasSpecial(e.special, 12) // 中毒
				|| core.hasSpecial(e.special, 13) // 衰弱
				|| core.hasSpecial(e.special, 14) // 诅咒
				|| core.hasSpecial(e.special, 19) // 自爆
				|| core.hasSpecial(e.special, 21) // 退化
				|| core.hasSpecial(e.special, 27) // 捕捉:逻辑上应该让怪物来找角色
				|| core.hasSpecial(e.special, 28) // 追猎:逻辑上应该让怪物来找角色
				|| core.hasSpecial(e.special, 29) // 败移:特殊战后事件
			)
				return false;
			const damage = core.getDamageInfo(enemy, void 0, x, y)?.damage;
			// 0伤或负伤，清
			if (has(damage) && damage <= 0) return true;
			return false;
		}

		/**
		 * 判断一个点是否能遍历
		 */
		function judge(block, nx, ny, tx, ty, dir, floorId, autoBattle, autoGet) {
			if (!has(block)) return {};
			const cls = block.event.cls;
			const loc = `${tx},${ty}`;
			const floor = core.floors[floorId];
			const changeFloor = floor.changeFloor[loc];
			const isEnemy = autoBattle && cls.startsWith('enemy'),
				isItem = autoGet && cls === 'items';

			if (has(changeFloor)) {
				if (!core.noPass(tx, ty, floorId) && !core.canMoveHero(nx, ny, dir)) {
					return false;
				}
				if (changeFloor.ignoreChangeFloor ?? core.flags.ignoreChangeFloor) {
					return true;
				}
				return false;
			}

			if (has(core.floors[floorId].events[loc])) return false;

			if (isEnemy || isItem)
				return {
					isEnemy,
					isItem,
				};

			return false;
		}

		/**
		 * 是否捡拾这个物品
		 */
		function canGetItem(item, loc, floorId) {
			// 可以用于检测道具是否应该被捡起，例如如果捡起后血量超过80%则不捡起可以这么写：
			// if (item.cls === 'items') {
			//     let diff = {};
			//     const before = core.status.hero;
			//     const hero = core.clone(core.status.hero);
			//     const handler = {
			//         set(target, key, v) {
			//             diff[key] = v - (target[key] || 0);
			//             if (!diff[key]) diff[key] = void 0;
			//             return true;
			//         }
			//     };
			//     core.status.hero = new Proxy(hero, handler);

			//     eval(item.itemEffect);

			//     core.status.hero = before;
			//     window.hero = before;
			//     window.flags = before.flags;
			//     if (
			//         diff.hp &&
			//         diff.hp + core.status.hero.hp > core.status.hero.hpmax * 0.8
			//     )
			//         return false;
			// }
			if (item.cls === 'items') {
				const itemEffectType = core.getItemEffectType(item.id);
				if (core.hasFlag('noRouting_HP') && itemEffectType.includes('hp')) return false;
				if (core.hasFlag('noRouting_MDEF') && itemEffectType.includes('mdef')) return false;
				if (core.hasFlag('noRouting_ATK') && itemEffectType.includes('atk')) return false;
				if (core.hasFlag('noRouting_DEF') && itemEffectType.includes('def')) return false;
			}
			return true;
		}

		/**
		 * @template T
		 * @param {T} v
		 * @returns {v is NonNullable<T>}
		 */
		function has(v) {
			return v !== null && v !== undefined;
		}

		function hasBlockDamage(loc) {
			const checkblockInfo = core.status.checkBlock;
			const damage = checkblockInfo.damage[loc];
			const ambush = checkblockInfo.ambush[loc];
			const repulse = checkblockInfo.repulse[loc];
			const chase = checkblockInfo.chase[loc];

			return (has(damage) && damage > 0) || has(ambush) || has(repulse) || has(chase);
		}

		/**
		 * 广搜，搜索可以到达的需要清的怪
		 * @param {string} floorId
		 */
		function bfs(floorId, deep = Infinity) {
			core.extractBlocks(floorId);
			const objs = core.getMapBlocksObj(floorId);
			const bgMap = core.getBgMapArray(floorId);
			const { x, y } = core.status.hero.loc;
			/** @type {[direction, number, number][]} */
			const dir = Object.entries(core.utils.scan).map(v => [v[0], v[1].x, v[1].y]);
			const floor = core.status.maps[floorId];

			/** @type {[number, number][]} */
			const queue = [[x, y]];
			const mapped = {
				[`${x},${y}`]: true
			};

			const autoBattle = core.getFlag('autoBattle', false),
				autoGet = core.getFlag('autoGet', false);
			if (!autoGet && !autoBattle) return;

			while (queue.length > 0 && deep > 0) {
				const [nx, ny] = queue.shift();
				dir.forEach(v => {
					const [tx, ty] = [nx + v[1], ny + v[2]];
					if (tx < 0 || ty < 0 || tx >= floor.width || ty >= floor.height) {
						return;
					}
					const loc = `${tx},${ty}`;
					if (mapped[loc]) return;
					if (core.onSki(bgMap[ty][tx])) return; // 寻路不允许穿过滑冰
					const block = objs[loc];
					mapped[loc] = true;
					const type = judge(block, nx, ny, tx, ty, v[0], floorId, autoBattle, autoGet);
					if (type === false) return;
					const { isEnemy, isItem } = type;

					if (isEnemy) {
						if (canBattle(block.event.id, tx, ty) && !block.disable) {
							core.battle(block.event.id, tx, ty);
							core.updateCheckBlock();
						} else {
							return;
						}
					} else if (isItem) {
						const item = core.material.items[block.event.id];
						if (canGetItem(item, loc, floorId)) {
							core.getItem(item.id, 1, tx, ty);
							if (!core.isReplaying() && Transition) {
								let px = tx * 32 - core.bigmap.offsetX;
								let py = ty * 32 - core.bigmap.offsetY;
								const t = new Transition();
								t.mode(hyper('sin', 'out'))
									.time(transitionTime)
									.absolute()
									.transition('x', px)
									.transition('y', py);
								let { x, y } = core.status.hero.loc;
								t.value.x = x * 32 - core.bigmap.offsetX;
								t.value.y = y * 32 - core.bigmap.offsetY;
								transitionList.push(t);
								t.ticker.add(() => {
									core.drawIcon(ctxName, item.id, t.value.x, t.value.y, 32, 32);
									let { x, y } = core.status.hero.loc;
									if (Math.abs(t.value.x - x * 32 + core.bigmap.offsetX) < 0.05 &&
										Math.abs(t.value.y - y * 32 + core.bigmap.offsetY) < 0.05
									) {
										t.ticker.destroy();
										const index = transitionList.findIndex(v => v === t);
										transitionList.splice(index, 1);
									}
								});
							}
						} else {
							return;
						}
					}
					if (hasBlockDamage(loc)) return;
					queue.push([tx, ty]);
				});
				deep--;
			}
		}

		function auto() {
			if (!core.status.floorId || !core.status.checkBlock.damage) return; // 这两个条件不知道什么情形下会出现
			if (core.status.event.id == 'action' || core.events.onSki() || core.status.lockControl) return; // 在冰上不允许触发自动清怪
			const before = flags.__forbidSave__;
			const { x, y } = core.status.hero.loc;
			const floor = core.floors[core.status.floorId];
			const loc = `${x},${y}`;
			const hasEvent = has(floor.events[loc]);
			if (hasEvent) return; // 如果有事件，直接不清了
			let deep = Infinity;
			if (hasBlockDamage(loc)) {
				deep = core.flags.enableGentleClick ? 1 : 0; // 角色站的位置有地图伤害时，仍然允许轻点附近1格
			}
			flags.__forbidSave__ = true;
			flags.__statistics__ = true;
			const ctx = core.getContextByName(ctxName);
			if (!ctx) core.createCanvas(ctxName, 0, 0, core.__PIXELS__, core.__PIXELS__, 75);
			bfs(core.status.floorId, deep);
			flags.__statistics__ = false;
			flags.__forbidSave__ = before;
			core.updateStatusBar();
		};
	},
	"scrollingText": function () {
		// 本插件用于绘制在线留言
		// 说明：https://h5mota.com/bbs/thread/?tid=1017
		// 目前使用core.http代替帖子中提到的axios

		/** 塔的英文名 */
		const towerName = core.firstData.name;

		let [W, H] = [core.__SIZE__, core.__SIZE__];
		let [WIDTH, HEIGHT] = [core.__PIXELS__, core.__PIXELS__];

		//#region 弹幕的收发
		this.getComment = function () {
			if (core.isReplaying()) return;
			let form = new FormData();
			form.append('type', 1);
			form.append('towername', towerName);
			utils.prototype.http(
				'POST',
				'https://h5mota.com/backend/tower/barrage.php',
				form,
				function (res) {
					try {
						res = JSON.parse(res);
						console.log(res);
						core.drawTip('接收成功！')
						core.playSound('item.mp3');
						let commentCollection = {};
						const commentList = res?.list;
						const isEmpty = /^\s*$/;
						for (let i = 0, l = commentList.length; i <= l - 1; i++) {
							if (isEmpty.test(commentList[i]?.comment)) continue;
							const commentTagsList = commentList[i].tags.split(',');
							const [cFloorId, cX, cY] = commentTagsList;
							if (0 <= cX && cX <= W - 1 && 0 <= cY && cY <= H - 1 && core.floorIds.includes(cFloorId)) {
								if (!commentCollection.hasOwnProperty(cFloorId)) { commentCollection[cFloorId] = {}; }
								const str = cX + ',' + cY;
								if (!commentCollection[cFloorId].hasOwnProperty(str)) { commentCollection[cFloorId][str] = []; }
								commentCollection[cFloorId][str].push(commentList[i]?.comment);
							}
						}
						core.setFlag('commentCollection', commentCollection);
					} catch (err) {
						core.drawFailTip('接收失败！' + err.message);
					}
				},
				function (err) {
					err = JSON.parse(err);
					console.error(err);
					core.drawFailTip('接收失败' + err?.message);
				},
				null, null, null, 1000
			);
		}

		this.postComment = function (comment, tags) {
			if (core.isReplaying()) return;
			const isEmpty = /^\s*$/;
			if (isEmpty.test(comment)) {
				core.drawFailTip('您输入的消息为空，请重发！');
				return;
			}
			let form = new FormData();
			form.append('type', 2);
			form.append('towername', towerName);
			form.append('comment', comment);
			form.append('tags', tags);
			utils.prototype.http(
				'POST',
				'https://h5mota.com/backend/tower/barrage.php',
				form,
				function (res) {
					try {
						res = JSON.parse(res);
						console.log(res);
						if (res?.code === 0) {
							core.drawTip('提交成功！')
						} else {
							core.drawTip('提交失败！' + res?.message);
						}
					}
					catch (err) {
						core.drawFailTip('提交失败！' + err.message);
					}
				},
				function (err) {
					err = JSON.parse(err);
					console.error(err);
					core.drawFailTip('提交失败！' + err?.message);
				},
				null, null, null, 1000
			);
		}
		//#endregion

		/** 若变量comment为真，在每层切换时在地上有弹幕的地方显示相应图标。 */
		this.drawCommentSign = function () {
			if (!core.hasFlag('comment') || core.isReplaying()) return;
			let commentCollection = core.getFlag('commentCollection', {}),
				floorId = core.status.floorId;
			core.createCanvas('sign', 0, 0, WIDTH, HEIGHT, 61);
			core.setOpacity('sign', 0.6);
			if (commentCollection.hasOwnProperty(floorId)) {
				for (let pos in commentCollection[floorId]) {
					const l = commentCollection[floorId][pos].length;
					for (let i = 0; i <= l - 1; i++) {
						const [x, y] = pos.split(',');
						core.drawIcon('sign', 'postman', 32 * x, 32 * y);
						break;
					}
				}
			}
		}

		/** 立即清除楼层的弹幕图标。关闭弹幕相关设置时调用。 */
		this.clearCommentSign = function () {
			core.deleteCanvas('sign');
		}

		/** 默认一次显示的弹幕数 */
		const showNum = 5;

		// 每走一步或瞬移，调用该函数，若目标点有弹幕，显示之
		this.showComment = function (x, y) {
			if (!core.getFlag('comment') || core.isReplaying()) return;
			const commentCollection = core.getFlag('commentCollection', {});
			const floorId = core.status.floorId,
				str = x + ',' + y;
			if (commentCollection.hasOwnProperty(floorId) &&
				commentCollection[floorId].hasOwnProperty(str)) {
				let commentArr = commentCollection[floorId][str].concat();
				const commentArrPicked = pickComment(commentArr, showNum);
				drawComment(commentArrPicked);
			}
		}

		/** 返回从commentArr中挑选showNum个comment组成的数组*/
		function pickComment(commentArr, showNum) {
			let showList = [];
			if (commentArr.length <= showNum) {
				showList = commentArr;
			} else {
				for (let i = 0; i <= showNum - 1; i++) {
					const l = commentArr.length,
						n = core.plugin.dice(l - 1);
					showList.push(commentArr[n]);
					commentArr.splice(n, 1);
				}
			}
			return showList;
		}

		function drawComment(commentArr) {
			const l = commentArr.length;
			let yList = generateCommentYList(20, HEIGHT - 20, showNum);
			if (l < showNum) yList = getRandomElements(yList, l);
			for (let i = 0; i <= l - 1; i++) {
				drawCommentStr(commentArr[i], WIDTH + 20 * Math.random(),
					yList[i], Math.random() * 0.1 + 0.1);
			}
		}

		/** 生成count个随机数，范围从min到max，作为弹幕的y坐标*/
		function generateCommentYList(min, max, count) {
			let yList = Array(count).fill(0);
			const distance = (max - min) / (count + 1);
			for (let i = 0; i < count; i++) {
				yList[i] = min + distance * (i + 1) + (Math.random() - 0.5) * (distance / 2);
			}
			return yList;
		}

		function getRandomElements(arr, count) {
			let result = [...arr];
			let len = result.length;
			count = Math.min(len, count);

			for (let i = len - 1; i > len - 1 - count; i--) {
				let j = Math.floor(Math.random() * (i + 1));
				[result[i], result[j]] = [result[j], result[i]];
			}

			return result.slice(len - count);
		}

		//#region 弹幕绘制部分
		const { Animation, linear, Ticker } = core.plugin.animate ?? {};
		const ctxName = 'scrollingText';

		if (Ticker) {
			const ticker = new Ticker();
			ticker.add(() => {
				if (core.isReplaying()) return;
				core.createCanvas(ctxName, 0, 0, core.__PIXELS__, core.__PIXELS__, 136); //每帧重绘该画布
			});
		}

		let commentCount = 0;
		/**
		 * 绘制弹幕 
		 * @example  
		 * drawCommentStr('OK', 450, 200, 0.1);
		 * @param {string} content 弹幕的内容
		 * @param {number} x 弹幕的初始x坐标
		 * @param {number} y 弹幕的初始y坐标
		 * @param {number} vx 弹幕的横向滚动速度
		 */
		function drawCommentStr(content, x, y, vx) {
			if (core.isReplaying() || !Animation) return;
			commentCount++;
			const aniName = 'comment' + commentCount;
			const ani = new Animation(aniName);
			ani.ticker.add(() => {
				core.fillText(ctxName, content, x + ani.x, y, 'white', '16px Verdana');
			})
			ani.mode(linear())
				.time(600 / vx)
				.absolute()
				.move(-600, 0)
			ani.all().then(() => { ani.ticker.destroy(); });
		}
		//#endregion 

	},
	"newBackpackLook": function () {
		// 这个插件有点离谱 个人觉得参数过多只会降低可读性，还不如硬编码

		// 注：///// *** 裹起来的区域： 该区域内参数可以随意更改调整ui绘制 不会影响总体布局
		// 请尽量修改该区域而不是其他区域 修改的时候最好可以对照现有ui修改

		///// *** 道具类型
		// cls对应name
		var itemClsName = {
			"constants": "永久道具",
			"tools": "消耗道具",
		}
		// 一页最大放的道具数量 将把整个道具左栏分成num份 每份是一个道具项
		var itemNum = 12;
		///// ***

		// 背景设置
		function drawBoxBackground(ctx) {
			core.setTextAlign(ctx, "left");
			core.clearMap(ctx);
			core.deleteCanvas("_selector");
			var info = core.status.thisUIEventInfo || {};

			///// *** 背景设置
			var max = core.__PIXELS__;
			var x = 2,
				y = x,
				w = max - x * 2,
				h = w;
			var borderWidth = 2,
				borderRadius = 5, // radius:圆角矩形的圆角半径
				borderStyle = "#fff";
			var backgroundColor = "gray";
			// 设置背景不透明度(0.85)
			var backgroundAlpha = 0.85;
			///// ***

			var start_x = x + borderWidth / 2,
				start_y = y + borderWidth / 2,
				width = max - start_x * 2,
				height = max - start_y * 2;

			// 渐变色背景的一个例子(黑色渐变白色)：
			// 有关渐变色的具体知识请网上搜索canvas createGradient了解
			/*
			   var grd = ctx.createLinearGradient(x, y, x + w, y);
			   grd.addColorStop(0, "black");
			   grd.addColorStop(1, "white");
			   backgroundColor = grd;
			*/
			// 使用图片背景要注释掉下面的strokeRect和fillRoundRect
			// 图片背景的一个例子：
			/*
			   core.drawImage(ctx, "xxx.png", x, y, w, h);
			   core.strokeRect(ctx, x, y, w, h, borderStyle, borderWidth);
			*/
			core.setAlpha(ctx, backgroundAlpha);
			core.strokeRoundRect(ctx, x, y, w, h, borderRadius, borderStyle, borderWidth);
			core.fillRoundRect(ctx, start_x, start_y, width, height, borderRadius, backgroundColor);
			core.setAlpha(ctx, 1);

			///// *** 左栏配置
			var leftbar_height = height;
			// 左边栏宽度(width*0.6) 本身仅为坐标使用 需要与底下的rightbar_width(width*0.4)同时更改
			var leftbar_width = width * 0.6;
			///// ***

			// xxx_right参数 代表最右侧坐标
			var leftbar_right = start_x + leftbar_width - borderWidth / 2;
			var leftbar_bottom = start_y + leftbar_height;
			var leftbar_x = start_x;
			var leftbar_y = start_y;

			///// *** 道具栏配置
			var boxName_color = "#fff";
			var boxName_fontSize = 15;
			var boxName_font = core.ui._buildFont(boxName_fontSize, true);
			var arrow_x = 10 + start_x;
			var arrow_y = 10 + start_y;
			var arrow_width = 20;
			var arrow_style = "white";
			// 暂时只能是1 否则不太行 等待新样板(2.7.3)之后对drawArrow做优化
			var arrow_lineWidth = 2;
			// 右箭头
			var rightArrow_right = leftbar_right - 10;
			// 道具内栏顶部坐标 本质是通过该项 控制(道具栏顶部文字和箭头)与道具内栏顶部的间隔
			var itembar_top = arrow_y + 15;
			///// ***

			var itembar_right = rightArrow_right;
			var boxName = core.status.event.id == "toolbox" ? "\r[yellow]道具栏\r | 装备栏" : "道具栏 | \r[yellow]装备栏\r";
			core.drawArrow(ctx, arrow_x + arrow_width, arrow_y, arrow_x, arrow_y, arrow_style, arrow_lineWidth);
			core.drawArrow(ctx, rightArrow_right - arrow_width, arrow_y, rightArrow_right, arrow_y, arrow_style, arrow_lineWidth);
			core.setTextAlign(ctx, "center");
			core.setTextBaseline(ctx, "middle");
			var changeBox = function () {
				var id = core.status.event.id;
				core.closePanel();
				if (id == "toolbox") core.openEquipbox();
				else core.openToolbox();
			}
			core.fillText(ctx, boxName, (leftbar_right + leftbar_x) / 2, arrow_y + 2, boxName_color, boxName_font);

			///// *** 底栏按钮
			var pageBtn_radius = 8;
			// xxx_left 最左侧坐标
			var pageBtn_left = leftbar_x + 3;
			var pageBtn_right = leftbar_right - 3;
			// xxx_bottom 最底部坐标
			var pageBtn_bottom = leftbar_bottom - 2;
			var pageBtn_borderStyle = "#fff";
			var pageBtn_borderWidth = 2;
			var pageText_color = "#fff";
			// 底部按钮与上面的道具内栏的间隔大小
			var bottomSpace = 8;
			///// ***

			drawItemListbox_setPageBtn(ctx, pageBtn_left, pageBtn_right, pageBtn_bottom, pageBtn_radius, pageBtn_borderStyle, pageBtn_borderWidth);
			var page = info.page || 1;
			var pageFontSize = pageBtn_radius * 2 - 4;
			var pageFont = core.ui._buildFont(pageFontSize);
			setPageItems(page);
			var num = itemNum;
			if (core.status.event.id == "equipbox") num -= 5;
			var maxPage = info.maxPage;
			var pageText = page + " / " + maxPage;
			core.setTextAlign(ctx, "center");
			core.setTextBaseline(ctx, "bottom");
			core.fillText(ctx, pageText, (leftbar_x + leftbar_right) / 2, pageBtn_bottom, pageText_color, pageFont);
			addUIEventListener(start_x, start_y, leftbar_right - start_x, arrow_y - start_y + 13, changeBox);
			var itembar_height = Math.ceil(pageBtn_bottom - pageBtn_radius * 2 - pageBtn_borderWidth / 2 - bottomSpace - itembar_top);
			var oneItemHeight = (itembar_height - 4) / itemNum;
			return {
				x: start_x,
				y: start_y,
				width: width,
				height: height,
				leftbar_right: leftbar_right,
				obj: {
					x: arrow_x,
					y: itembar_top,
					width: itembar_right - arrow_x,
					height: itembar_height,
					oneItemHeight: oneItemHeight
				}
			}
		}

		function drawItemListbox(ctx, obj) {
			ctx = ctx || core.canvas.ui;
			var itembar_x = obj.x,
				itembar_y = obj.y,
				itembar_width = obj.width,
				itembar_height = obj.height,
				itemNum = obj.itemNum,
				oneItemHeight = obj.oneItemHeight;
			var itembar_right = itembar_x + itembar_width;
			var info = core.status.thisUIEventInfo || {};
			var obj = {};
			var page = info.page || 1,
				index = info.index,
				select = info.select || {};

			///// *** 道具栏内栏配置
			var itembar_style = "black";
			var itembar_alpha = 0.7;
			// 一个竖屏下减少道具显示的例子:
			// if (core.domStyle.isVertical) itemNum = 10;
			// 每个道具项的上下空隙占总高度的比例
			var itembar_marginHeightRatio = 0.2;
			// 左右间隔空隙
			var item_marginLeft = 2;
			var item_x = itembar_x + 2,
				item_y = itembar_y + 2,
				item_right = itembar_right - 2,
				itemName_color = "#fff";
			// 修改此项以更换闪烁光标
			var item_selector = "winskin.png";
			///// ***

			core.setAlpha(ctx, itembar_alpha);
			core.fillRect(ctx, itembar_x, itembar_y, itembar_width, itembar_height, itembar_style);
			core.setAlpha(ctx, 1);
			var pageItems = setPageItems(page);
			var marginHeight = itembar_marginHeightRatio * oneItemHeight;
			core.setTextBaseline(ctx, "middle");
			var originColor = itemName_color;
			for (var i = 0; i < pageItems.length; i++) {
				itemName_color = originColor;
				var item = pageItems[i];
				// 设置某个的字体颜色的一个例子
				// if (item.id == "xxx") itemName_color = "green";
				drawItemListbox_drawItem(ctx, item_x, item_right, item_y, oneItemHeight, item_marginLeft, marginHeight, itemName_color, pageItems[i]);
				if (index == i + 1) core.ui._drawWindowSelector(item_selector, item_x + 1, item_y - 1, item_right - item_x - 2, oneItemHeight - 2);
				item_y += oneItemHeight;
			}
		}

		function drawToolboxRightbar(ctx, obj) {
			ctx = ctx || core.canvas.ui;
			var info = core.status.thisUIEventInfo || {};
			var page = info.page || 1,
				index = info.index || 1,
				select = info.select || {};
			var start_x = obj.x,
				start_y = obj.y,
				width = obj.width,
				height = obj.height;
			var toolboxRight = start_x + width,
				toolboxBottom = start_y + height;


			///// *** 侧边栏(rightbar)背景设置(物品介绍)
			var rightbar_width = width * 0.4;
			var rightbar_height = height;
			var rightbar_lineWidth = 2;
			var rightbar_lineStyle = "#fff";
			///// ***

			var rightbar_x = toolboxRight - rightbar_width - rightbar_lineWidth / 2;
			var rightbar_y = start_y;
			core.drawLine(ctx, rightbar_x, rightbar_y, rightbar_x, rightbar_y + rightbar_height, rightbar_lineStyle, rightbar_lineWidth);

			// 获取道具id(有可能为null)
			var itemId = select.id;
			var item = core.material.items[itemId];

			///// *** 侧边栏物品Icon信息
			var iconRect_y = rightbar_y + 10;
			// space：间距
			// 这里布局设定iconRect与侧边栏左边框 itemName与工具栏右边框 itemRect与itemName的间距均为space
			var space = 15;
			var iconRect_x = rightbar_x + space;
			var iconRect_radius = 2,
				iconRect_width = 32,
				iconRect_height = 32,
				iconRect_style = "#fff",
				iconRect_lineWidth = 2;
			///// ***

			var iconRect_bottom = iconRect_y + iconRect_height,
				iconRect_right = iconRect_x + iconRect_width;

			///// *** 侧边栏各项信息
			var itemTextFontSize = 15,
				itemText_x = iconRect_x - 4,
				itemText_y = Math.floor(start_y + rightbar_height * 0.25), // 坐标取整防止模糊
				itemClsFontSize = 15,
				itemClsFont = core.ui._buildFont(itemClsFontSize),
				itemClsColor = "#fff",
				itemCls_x = itemText_x - itemClsFontSize / 2,
				itemCls_middle = (iconRect_bottom + itemText_y) / 2, //_middle代表文字的中心y坐标
				itemNameFontSize = 18,
				itemNameColor = "#fff",
				itemNameFont = core.ui._buildFont(itemNameFontSize, true);
			var itemName_x = iconRect_right + space;
			var itemName_middle = iconRect_y + iconRect_height / 2 + iconRect_lineWidth;
			// 修改这里可以编辑未选中道具时的默认值
			var defaultItem = {
				cls: "constants",
				name: "未知道具",
				text: "没有道具最永久"
			}
			var defaultEquip = {
				cls: "equips",
				name: "未知装备",
				text: "一无所有，又何尝不是一种装备",
				equip: {
					type: "装备"
				}
			}
			///// ***

			var originItem = item;
			if (core.status.event.id == "equipbox") item = item || defaultEquip;
			item = item || defaultItem;
			var itemCls = item.cls,
				itemName = item.name,
				itemText = item.text;
			itemText = core.replaceText(itemText);
			if (!itemText) itemText = '该道具无描述。'
			/* 一个根据道具id修改道具名字(右栏)的例子
			 * if (item.id == "xxx") itemNameColor = "red";
			 */
			var itemClsName = core.getItemClsName(item);
			var itemNameMaxWidth = rightbar_width - iconRect_width - iconRect_lineWidth * 2 - space * 2;
			core.strokeRoundRect(ctx, iconRect_x, iconRect_y, iconRect_width, iconRect_height, iconRect_radius, iconRect_style, iconRect_lineWidth);
			if (item.id)
				core.drawIcon(ctx, item.id, iconRect_x + iconRect_lineWidth / 2, iconRect_y + iconRect_lineWidth / 2, iconRect_width - iconRect_lineWidth, iconRect_height - iconRect_lineWidth);
			core.setTextAlign(ctx, "left");
			core.setTextBaseline(ctx, "middle");
			core.fillText(ctx, itemName, itemName_x, itemName_middle, itemNameColor, itemNameFont, itemNameMaxWidth);
			core.fillText(ctx, "【" + itemClsName + "】", itemCls_x, itemCls_middle, itemClsColor, itemClsFont);
			var statusText = "";
			if (core.status.event.id == "equipbox") {
				var type = item.equip.type;
				if (typeof type == "string") type = core.getEquipTypeByName(type);
				var compare = core.compareEquipment(item.id, core.getEquip(type));
				if (info.select.action == "unload") compare = core.compareEquipment(null, item.id);
				// --- 变化值...
				for (var name in core.status.hero) {
					if (typeof core.status.hero[name] != 'number') continue;
					var nowValue = core.getRealStatus(name);
					// 查询新值
					var newValue = Math.floor((core.getStatus(name) + (compare.value[name] || 0)) *
						(core.getBuff(name) * 100 + (compare.percentage[name] || 0)) / 100);
					if (nowValue == newValue) continue;
					var color = newValue > nowValue ? '#00FF00' : '#FF0000';
					nowValue = core.formatBigNumber(nowValue);
					newValue = core.formatBigNumber(newValue);
					statusText += core.getStatusLabel(name) + " " + nowValue + "->\r[" + color + "]" + newValue + "\r\n";
				}
			}
			itemText = statusText + itemText;
			core.drawTextContent(ctx, itemText, {
				left: itemText_x,
				top: itemText_y,
				bold: false,
				color: "white",
				align: "left",
				fontSize: itemTextFontSize,
				maxWidth: rightbar_width - (itemText_x - rightbar_x) * 2 + itemTextFontSize / 2
			});

			///// *** 退出按钮设置
			var btnRadius = 10;
			var btnBorderWidth = 2;
			var btnRight = toolboxRight - 2;
			var btnBottom = toolboxBottom - 2;
			var btnBorderStyle = "#fff";
			///// ***

			// 获取圆心位置
			var btn_x = btnRight - btnRadius - btnBorderWidth / 2;
			btn_y = btnBottom - btnRadius - btnBorderWidth / 2;
			drawToolbox_setExitBtn(ctx, btn_x, btn_y, btnRadius, btnBorderStyle, btnBorderWidth);

			///// *** 使用按钮设置
			var useBtnHeight = btnRadius * 2;
			// 这里不设置useBtnWidth而是根据各项数据自动得出width
			var useBtnRadius = useBtnHeight / 4;
			var useBtn_x = rightbar_x + 4,
				useBtn_y = btnBottom - useBtnHeight;
			var useBtnBorderStyle = "#fff";
			var useBtnBorderWidth = btnBorderWidth;
			const batchUseBtn_x = useBtn_x + 50; // 个人觉得，搞这么多参数还不如硬编码
			const hideBtn_y = useBtn_y - useBtnHeight - 8;
			///// ***

			drawToolbox_setUseBtn(ctx, useBtn_x, useBtn_y, useBtnRadius, useBtnHeight, useBtnBorderStyle, useBtnBorderWidth);
			if (core.status.event.id === 'toolbox') {
				drawToolbox_setBatchUseBtn(ctx, batchUseBtn_x, useBtn_y, useBtnRadius, useBtnHeight, useBtnBorderStyle, useBtnBorderWidth);
			}
			drawToolbox_setHideBtn(ctx, useBtn_x, hideBtn_y, useBtnRadius, useBtnHeight, useBtnBorderStyle, useBtnBorderWidth);
			drawToolbox_setShowHideBtn(ctx, rightbar_x, useBtn_y, useBtnHeight, useBtnBorderStyle);
		}

		function drawEquipbox_drawOthers(ctx, obj) {
			var info = core.status.thisUIEventInfo;

			///// *** 装备格设置
			var equipList_lineWidth = 2;
			var equipList_boxSize = 32;
			var equipList_borderWidth = 2;
			var equipList_borderStyle = "#fff";
			var equipList_nameColor = "#fff";
			///// ***

			var equipList_x = obj.x + 4,
				equipList_bottom = obj.obj.y - equipList_lineWidth,
				equipList_y = equipList_bottom - obj.obj.oneItemHeight * reduceItem - 2,
				equipList_height = equipList_bottom - equipList_y;
			var equipList_right = obj.leftbar_right,
				equipList_width = equipList_right - equipList_x;
			core.drawLine(ctx, obj.x, equipList_bottom + equipList_lineWidth / 2, equipList_right, equipList_bottom + equipList_lineWidth / 2, equipList_borderStyle, equipList_lineWidth);
			var toDrawList = core.status.globalAttribute.equipName,
				len = toDrawList.length;

			///// *** 装备格设置
			var maxItem = 4;
			var box_width = 32,
				box_height = 32,
				box_borderStyle = "#fff",
				box_selectBorderStyle = "gold", // 选中的装备格的颜色
				box_borderWidth = 2;
			var boxName_fontSize = 14,
				boxName_space = 2,
				boxName_color = "#fff"; // 装备格名称与上面的装备格框的距离
			var maxLine = Math.ceil(len / maxItem);
			///// ***
			var l = Math.sqrt(len)
			if (Math.pow(l) == len && len != 4) {
				if (l <= maxItem) maxItem = l;
			}
			maxItem = Math.min(toDrawList.length, maxItem);
			info.equips = maxItem;

			var boxName_font = core.ui._buildFont(boxName_fontSize);
			// 总宽高减去所有装备格宽高得到空隙大小
			var oneBoxWidth = box_width + box_borderWidth * 2;
			var oneBoxHeight = box_height + boxName_fontSize + boxName_space + 2 * box_borderWidth;
			var space_y = (equipList_height - maxLine * oneBoxHeight) / (1 + maxLine),
				space_x = (equipList_width - maxItem * oneBoxWidth) / (1 + maxItem);
			var box_x = equipList_x + space_x,
				box_y = equipList_y + space_y;
			for (var i = 0; i < len; i++) {
				var id = core.getEquip(i),
					name = toDrawList[i];
				var selectBorder = false;
				if (core.status.thisUIEventInfo.select.type == i) selectBorder = true;
				var borderStyle = selectBorder ? box_selectBorderStyle : box_borderStyle;
				drawEquipbox_drawOne(ctx, name, id, box_x, box_y, box_width, box_height, boxName_space, boxName_font, boxName_color, borderStyle, box_borderWidth);
				var todo = new Function("core.clickOneEquipbox('" + id + "'," + i + ")");
				addUIEventListener(box_x - box_borderWidth / 2, box_y - box_borderWidth / 2, oneBoxWidth, oneBoxHeight, todo);
				box_x += space_x + oneBoxWidth;
				if ((i + 1) % maxItem == 0) {
					box_x = equipList_x + space_x;
					box_y += space_y + oneBoxHeight;
				}
			}
		}

		this.drawToolbox = function (ctx) {
			ctx = ctx || core.canvas.ui;
			core.status.thisEventClickArea = [];

			var info = drawBoxBackground(ctx);
			info.itemNum = itemNum;
			drawItemListbox(ctx, info.obj);
			drawToolboxRightbar(ctx, info);
			core.setTextBaseline(ctx, "alphabetic");
			core.setTextAlign("left");
		}

		var reduceItem = 4;
		this.drawEquipbox = function (ctx) {
			ctx = ctx || core.canvas.ui;
			core.status.thisEventClickArea = [];
			var info = drawBoxBackground(ctx);
			info.itemNum = itemNum - reduceItem;
			info.obj.y += info.obj.oneItemHeight * reduceItem;
			info.obj.height -= info.obj.oneItemHeight * reduceItem;
			drawItemListbox(ctx, info.obj);
			drawEquipbox_drawOthers(ctx, info);
			drawToolboxRightbar(ctx, info);
			core.setTextBaseline(ctx, "alphabetic");
			core.setTextAlign("left");
		}


		function drawEquipbox_drawOne(ctx, name, id, x, y, width, height, space, font, color, style, lineWidth) {
			if (id) core.drawIcon(ctx, id, x + lineWidth / 2, y + lineWidth / 2, width, height);
			core.strokeRect(ctx, x, y, width + lineWidth, height + lineWidth, style, lineWidth);
			core.setTextAlign(ctx, "center");
			core.setTextBaseline(ctx, "top");
			var tx = (x + x + lineWidth / 2 + width) / 2,
				ty = y + height + lineWidth / 2 * 3 + space;
			core.fillText(ctx, name, tx, ty, color, font);

			core.setAlpha(ctx, 1);

			core.setTextBaseline(ctx, "alphabetic");
			core.setTextAlign("left");
		}

		function drawItemListbox_drawItem(ctx, left, right, top, height, marginLeft, marginHeight, style, id) {
			var info = core.status.thisUIEventInfo;
			var nowClick = info.index;
			var item = core.material.items[id] || {};
			var name = item.name || "???";
			var num = core.itemCount(id) || 0;
			var fontSize = Math.floor(height - marginHeight * 2);
			core.setTextAlign(ctx, "right");
			var numText = "x" + num;
			core.fillText(ctx, numText, right - marginLeft, top + height / 2, style, core.ui._buildFont(fontSize));

			const hideInfo = core.getFlag('hideInfo', {});
			if (item && (hideInfo.hasOwnProperty(id) ? hideInfo[id] : item.hideInToolbox)) core.setAlpha(ctx, 0.5);

			if (name != "???") core.drawIcon(ctx, id, left + marginLeft, top + marginHeight, fontSize, fontSize);
			var text_x = left + marginLeft + fontSize + 2;
			var maxWidth = right - core.calWidth(ctx, numText) - text_x;
			core.setTextAlign(ctx, "left");
			core.fillText(ctx, name, text_x, top + height / 2, style, core.ui._buildFont(fontSize), maxWidth);
			core.setAlpha(ctx, 1);

			var todo = new Function("core.clickItemFunc('" + id + "');");
			addUIEventListener(left, top, right - left, height, todo);
		}

		function setPageItems(page) {
			var num = itemNum;
			if (core.status.event.id == "equipbox") num -= reduceItem;
			var info = core.status.thisUIEventInfo;
			if (!info) return;
			page = page || info.page;
			var items = core.getToolboxItems(core.status.event.id == "toolbox" ? "all" : "equips", core.getFlag('showHideItem', false));
			info.allItems = items;
			var maxPage = Math.ceil(items.length / num);
			info.maxPage = maxPage;
			var pageItems = items.slice((page - 1) * num, page * num);
			info.pageItems = pageItems;
			info.maxItem = pageItems.length;
			if (items.length == 0 && pageItems.length == 0) info.index = null;
			if (pageItems.length == 0 && info.page > 1) {
				info.page = Math.max(1, info.page - 1);
				return setPageItems(info.page);
			}
			return pageItems;
		}

		function drawToolbox_setExitBtn(ctx, x, y, r, style, lineWidth) {
			core.strokeCircle(ctx, x, y, r, style, lineWidth);
			ctx.textAlign = "center";
			ctx.textBaseline = "middle";
			var textSize = Math.sqrt(2) * r;
			core.fillText(ctx, "x", x, y, style, core.ui._buildFont(textSize), textSize);
			core.setTextAlign(ctx, "start");
			core.setTextBaseline(ctx, "top");

			var todo = function () {
				core.closePanel();
			}
			addUIEventListener(x - r, y - r, r * 2, r * 2, todo);
		}

		function drawToolbox_setUseBtn(ctx, x, y, r, h, style, lineWidth) {
			core.setTextAlign(ctx, "left");
			core.setTextBaseline(ctx, "top");
			var fontSize = h - 4;
			var font = core.ui._buildFont(fontSize);
			var text = core.status.event.id == "toolbox" ? "使用" : "装备";
			if (core.status.thisUIEventInfo.select.action == "unload") text = "卸下";
			var w = core.calWidth(ctx, text, font) + 2 * r + lineWidth / 2;

			core.strokeRoundRect(ctx, x, y, w, h, r, style, lineWidth);
			core.fillText(ctx, text, x + r, y + lineWidth / 2 + 2, style, font);

			var todo = function () {
				core.useSelectItemInBox();
			}
			addUIEventListener(x, y, w, h, todo);
		}

		function getSelectedItem() {
			var info = core.status.thisUIEventInfo;
			if (!(info && info.select.id && ["toolbox", "equipbox"].includes(core.status.event.id))) {
				core.drawFailTip('发生了未知错误！');
				return;
			}
			return info.select.id;
		}

		function batchUse(item, count) {
			try {
				const itemCount = core.itemCount(item);
				if (count > itemCount) count = itemCount;
				core.closePanel();
				for (let i = 0; i < count; i++) {
					if (core.canUseItem(item)) core.useItem(item);
					else return;
				}
			} catch (e) {
				console.error(e);
				core.drawFailTip('批量使用时出现未知错误！');
			}
		}

		function drawToolbox_setBatchUseBtn(ctx, x, y, r, h, style, lineWidth) {
			try {
				const selectedItem = getSelectedItem();
				let canBatchUse = eval(core.material.items[selectedItem]?.canBatchUse);
				if (!canBatchUse) return;
			}
			catch (error) {
				console.error(error);
				return;
			}
			core.setTextAlign(ctx, "left");
			core.setTextBaseline(ctx, "top");
			var fontSize = h - 4;
			var font = core.ui._buildFont(fontSize);
			var text = "批量使用";
			var w = core.calWidth(ctx, text, font) + 2 * r + lineWidth / 2;

			core.strokeRoundRect(ctx, x, y, w, h, r, style, lineWidth);
			core.fillText(ctx, text, x + r, y + lineWidth / 2 + 2, style, font);

			var todo = function () {
				core.utils.myprompt('输入要使用该物品的次数(0~99)。', null, (value) => {

					value = parseInt(value);
					const id = getSelectedItem();

					if (Number.isNaN(value) || value < 0 || value > 99) {
						core.drawFailTip('输入不合法！');
						return;
					}
					if (!core.canUseItem(id)) {
						core.drawFailTip('当前无法使用该道具！');
						return;
					}
					core.closePanel();
					batchUse(id, value);
				});
			}
			addUIEventListener(x, y, w, h, todo);
		}

		function drawToolbox_setHideBtn(ctx, x, y, r, h, style, lineWidth) {
			core.setTextAlign(ctx, "left");
			core.setTextBaseline(ctx, "top");
			var fontSize = h - 4;
			var font = core.ui._buildFont(fontSize);
			var text = "显示/隐藏";
			var w = core.calWidth(ctx, text, font) + 2 * r + lineWidth / 2;

			core.strokeRoundRect(ctx, x, y, w, h, r, style, lineWidth);
			core.fillText(ctx, text, x + r, y + lineWidth / 2 + 2, style, font);

			var todo = function () {
				//debugger;
				var id = getSelectedItem();
				let hideInfo = core.getFlag('hideInfo', {});
				console.log(id);
				if (hideInfo.hasOwnProperty(id)) {
					hideInfo[id] = !hideInfo[id];
					core.setFlag('hideInfo', hideInfo);
				} else {
					hideInfo[id] = !core.material.items[id].hideInToolbox;
					core.setFlag('hideInfo', hideInfo);
				}
				if (core.status.event.id === 'toolbox') core.plugin.drawToolbox();
				else if (core.status.event.id === 'equipbox') core.plugin.drawEquipbox();
			}
			addUIEventListener(x, y, w, h, todo);
		}

		ui.prototype.getToolboxItems = function (cls, showHide) {
			let list = Object.keys(core.status.hero.items[cls] || {});;
			if (cls === 'all') {
				for (let name in core.status.hero.items) {
					if (name == "equips") continue;
					list = list.concat(Object.keys(core.status.hero.items[name])); // 获取'constants'和'tools'整体的列表
				}
				if (!showHide) list = list.filter(function (id) {
					const hideInfo = core.getFlag('hideInfo', {});
					if (hideInfo.hasOwnProperty(id)) return !hideInfo[id];
					else return !core.material.items[id].hideInToolbox;
				})
				list = list.sort();
				return list;
			}

			if (this.uidata.getToolboxItems) {
				return this.uidata.getToolboxItems(cls, showHide);
			}
			if (!showHide) list = list.filter(function (id) {
				return !core.material.items[id].hideInToolbox;
			})
			list = list.sort();
			return list;
		}

		function drawToolbox_setShowHideBtn(ctx, x, y, h, style) {
			core.setTextAlign(ctx, "left");
			core.setTextBaseline(ctx, "top");
			var fontSize = h - 6;
			var font = core.ui._buildFont(fontSize);
			var text = "显示隐藏";
			var w = core.calWidth(ctx, text, font)
			h += 4;
			const squareSize = h - 6;

			x -= w + squareSize + 26;

			const border = 2;
			core.fillRect(ctx, x, y, squareSize, squareSize, ' #F5F5F5');
			if (core.hasFlag('showHideItem')) {
				core.fillRect(ctx, x + border, y + border, squareSize - 2 * border, squareSize - 2 * border, 'lime');
			}
			core.fillText(ctx, text, x + squareSize + 2, y + 4, style, font);

			var todo = function () {
				core.setFlag('showHideItem', !core.getFlag('showHideItem', false));
				if (core.status.event.id === 'toolbox') core.plugin.drawToolbox();
				else if (core.status.event.id === 'equipbox') core.plugin.drawEquipbox();
			}
			addUIEventListener(x, y, w, h, todo);
		}

		function drawItemListbox_setPageBtn(ctx, left, right, bottom, r, style, lineWidth) {
			var offset = lineWidth / 2 + r;

			var x = left + offset;
			var y = bottom - offset;
			var pos = Math.sqrt(2) / 2 * (r - lineWidth / 2);
			core.fillPolygon(ctx, [
				[x - pos, y],
				[x + pos - 2, y - pos],
				[x + pos - 2, y + pos]
			], style);
			core.strokeCircle(ctx, x, y, r, style, lineWidth);
			var todo = function () {
				core.addItemListboxPage(-1);
			}
			addUIEventListener(x - r - 2, y - r - 2, r * 2 + 4, r * 2 + 4, todo);

			x = right - offset;
			core.fillPolygon(ctx, [
				[x + pos, y],
				[x - pos + 2, y - pos],
				[x - pos + 2, y + pos]
			], style);
			core.strokeCircle(ctx, x, y, r, style, lineWidth);
			var todo = function () {
				core.addItemListboxPage(1);
			}
			addUIEventListener(x - r - 2, y - r - 2, r * 2 + 4, r * 2 + 4, todo);
		}

		this.clickItemFunc = function (id) {
			var info = core.status.thisUIEventInfo;
			if (!info) return;
			if (info.select.id == id) return core.useSelectItemInBox();
			info.select = {};
			info.select.id = id;
			core.setIndexAndSelect('index');
			refreshBox();
		}

		this.clickOneEquipbox = function (id, type) {
			var info = core.status.thisUIEventInfo;
			if (!info) return;
			if (info.select.id == id && info.select.type == type) core.useSelectItemInBox();
			else core.status.thisUIEventInfo.select = {
				id: id,
				type: type,
				action: "unload"
			}
			return refreshBox();
		}

		this.useSelectItemInBox = function () {
			var info = core.status.thisUIEventInfo;
			if (!info) return;
			if (!info.select.id) return;
			var id = info.select.id;
			if (core.status.event.id == "toolbox") {
				core.events.tryUseItem(id);
				// core.closePanel();
			} else if (core.status.event.id == "equipbox") {
				var action = info.select.action || "load";
				info.index = 1;
				if (action == "load") {
					var type = core.getEquipTypeById(id);
					core.loadEquip(id, function () {
						core.status.route.push("equip:" + id);
						info.select.type = type;
						core.setIndexAndSelect("select");
						core.drawEquipbox();
					});
				} else {
					var type = info.select.type;
					core.unloadEquip(type, function () {
						core.status.route.push("unEquip:" + type);
						info.select.type = type;
						//info.select.action = 'load'
						core.setIndexAndSelect("select");
						core.drawEquipbox();
					});
				}
			}
		}

		this.setIndexAndSelect = function (toChange) {
			var info = core.status.thisUIEventInfo;
			if (!info) return;
			setPageItems(info.page);
			var index = info.index || 1;
			var items = info.pageItems;
			if (info.select.type != null) {
				var type = info.select.type;
				id = core.getEquip(type);
				info.index = null;
				info.select = {
					id: id,
					action: "unload",
					type: type
				};
				return;
			} else {
				info.select.action = null;
				info.select.type = null;
				if (toChange == "index") info.index = items.indexOf(info.select.id) + 1;
				info.select.id = items[info.index - 1];
			}

		}

		this.addItemListboxPage = function (num) {
			var info = core.status.thisUIEventInfo;
			if (!info) return;
			var maxPage = info.maxPage || 1;
			info.page = info.page || 1;
			info.page += num;
			if (info.page <= 0) info.page = maxPage;
			if (info.page > maxPage) info.page = 1;
			info.index = 1;
			setPageItems(info.page);
			core.setIndexAndSelect("select");
			refreshBox();
		}

		this.addItemListboxIndex = function (num) {
			var info = core.status.thisUIEventInfo;
			if (!info) return;
			var maxItem = info.maxItem || 0;
			info.index = info.index || 0;
			info.index += num;
			if (info.index <= 0) info.index = 1;
			if (info.index > maxItem) info.index = maxItem;
			core.setIndexAndSelect("select");
			refreshBox();
		}

		this.addEquipboxType = function (num) {
			var info = core.status.thisUIEventInfo;
			var type = info.select.type;
			if (type == null && num > 0) info.select.type = 0;
			else info.select.type = type + num;
			var max = core.status.globalAttribute.equipName.length;
			if (info.select.type >= max) {
				info.select = {};
				core.setIndexAndSelect("select")
				return core.addItemListboxPage(0);
			} else {
				var m = Math.abs(info.select.type);
				if (info.select.type < 0) info.select.type = max - m;
				core.setIndexAndSelect("select")
				refreshBox();
				return;
			}
		}

		core.actions._keyDownToolbox = function (keycode) {
			if (!core.status.thisEventClickArea) return;
			if (keycode == 37) { // left
				core.addItemListboxPage(-1);
				return;
			}
			if (keycode == 38) { // up
				core.addItemListboxIndex(-1);
				return;
			}
			if (keycode == 39) { // right
				core.addItemListboxPage(1);
				return;
			}
			if (keycode == 40) { // down
				core.addItemListboxIndex(1);
				return;
			}
		}

		////// 工具栏界面时，放开某个键的操作 //////
		core.actions._keyUpToolbox = function (keycode) {
			if (keycode == 81) {
				core.ui.closePanel();
				if (core.isReplaying())
					core.control._replay_equipbox();
				else
					core.openEquipbox();
				return;
			}
			if (keycode == 84 || keycode == 27 || keycode == 88) {
				core.closePanel();
				return;
			}
			if (keycode == 13 || keycode == 32 || keycode == 67) {
				var info = core.status.thisUIEventInfo;
				if (info.select) {
					core.useSelectItemInBox();
				}
				return;
			}
		}

		core.actions._keyDownEquipbox = function (keycode) {
			if (!core.status.thisEventClickArea) return;
			if (keycode == 37) { // left
				var info = core.status.thisUIEventInfo;
				if (info.index != null) return core.addItemListboxPage(-1);
				return core.addEquipboxType(-1);
			}
			if (keycode == 38) { // up
				var info = core.status.thisUIEventInfo;
				if (info.index == 1) {
					info.select.type = core.status.globalAttribute.equipName.length - 1;
					core.setIndexAndSelect();
					return refreshBox();
				}
				if (info.index) return core.addItemListboxIndex(-1);
				return core.addEquipboxType(-1 * info.equips);
			}
			if (keycode == 39) { // right
				var info = core.status.thisUIEventInfo;
				if (info.index != null) return core.addItemListboxPage(1);
				return core.addEquipboxType(1);
			}
			if (keycode == 40) { // down
				var info = core.status.thisUIEventInfo;
				if (info.index) return core.addItemListboxIndex(1);
				return core.addEquipboxType(info.equips);
			}
		}

		core.actions._keyUpEquipbox = function (keycode, altKey) {
			if (altKey && keycode >= 48 && keycode <= 57) {
				core.items.quickSaveEquip(keycode - 48);
				return;
			}
			if (keycode == 84) {
				core.ui.closePanel();
				if (core.isReplaying())
					core.control._replay_toolbox();
				else
					core.openToolbox();
				return;
			}
			if (keycode == 81 || keycode == 27 || keycode == 88) {
				core.closePanel();
				return;
			}
			if (keycode == 13 || keycode == 32 || keycode == 67) {
				var info = core.status.thisUIEventInfo;
				if (info.select) core.useSelectItemInBox();
				return;
			}
		}

		core.registerAction("ondown", "inEventClickAction", function (x, y, px, py) {
			if (!core.status.thisEventClickArea) return false;
			var info = core.status.thisEventClickArea;
			for (var i = 0; i < info.length; i++) {
				var obj = info[i];
				if (px >= obj.x && px <= obj.x + obj.width && py > obj.y && py < obj.y + obj.height) {
					if (obj.todo) obj.todo();
					break;
				}
			}
			return true;
		}, 51);
		core.registerAction("onclick", "stopClick", function () {
			if (core.status.thisEventClickArea) return true;
		}, 51);

		function addUIEventListener(x, y, width, height, todo) {
			if (!core.status.thisEventClickArea) return;
			var obj = {
				x: x,
				y: y,
				width: width,
				height: height,
				todo: todo
			}
			core.status.thisEventClickArea.push(obj);
		}

		this.initThisEventInfo = function () {
			core.status.thisUIEventInfo = {
				page: 1,
				select: {}
			};
			core.status.thisEventClickArea = [];
		}

		function refreshBox() {
			if (!core.status.event.id) return;
			if (core.status.event.id == "toolbox") core.drawToolbox();
			else core.drawEquipbox();
		}

		core.ui.closePanel = function () {
			if (core.status.hero && core.status.hero.flags) {
				// 清除全部临时变量
				Object.keys(core.status.hero.flags).forEach(function (name) {
					if (name.startsWith("@temp@") || /^arg\d+$/.test(name)) {
						delete core.status.hero.flags[name];
					}
				});
			}
			this.clearUI();
			core.maps.generateGroundPattern();
			core.updateStatusBar(true);
			core.unlockControl();
			core.status.event.data = null;
			core.status.event.id = null;
			core.status.event.selection = null;
			core.status.event.ui = null;
			core.status.event.interval = null;
			core.status.thisUIEventInfo = null;
			core.status.thisEventClickArea = null
		}

		this.getItemClsName = function (item) {
			if (item == null) return itemClsName;
			if (item.cls == "equips") {
				if (typeof item.equip.type == "string") return item.equip.type;
				var type = core.getEquipTypeById(item.id);
				return core.status.globalAttribute.equipName[type];
			} else return itemClsName[item.cls] || item.cls;
		}

		core.events.openToolbox = function (fromUserAction) {
			if (core.isReplaying()) return;
			if (!this._checkStatus('toolbox', fromUserAction)) return;
			core.initThisEventInfo();
			let info = core.status.thisUIEventInfo
			info.index = 1
			core.setIndexAndSelect('select')
			core.drawToolbox();
		}

		core.events.openEquipbox = function (fromUserAction) {
			if (core.isReplaying()) return;
			if (!this._checkStatus('equipbox', fromUserAction)) return;
			core.initThisEventInfo();
			let info = core.status.thisUIEventInfo
			info.select.type = 0
			core.setIndexAndSelect('select')
			core.drawEquipbox();
		}

		core.control._replay_toolbox = function () {
			if (!core.isPlaying() || !core.isReplaying()) return;
			if (!core.status.replay.pausing) return core.drawTip("请先暂停录像");
			if (core.isMoving() || core.status.replay.animate || core.status.event.id)
				return core.drawTip("请等待当前事件的处理结束");

			core.lockControl();
			core.status.event.id = 'toolbox';
			core.drawToolbox();
		}

		core.control._replay_equipbox = function () {
			if (!core.isPlaying() || !core.isReplaying()) return;
			if (!core.status.replay.pausing) return core.drawTip("请先暂停录像");
			if (core.isMoving() || core.status.replay.animate || core.status.event.id)
				return core.drawTip("请等待当前事件的处理结束");

			core.lockControl();
			core.status.event.id = 'equipbox';
			core.drawEquipbox();
		}

		core.control._replayAction_item = function (action) {
			if (action.indexOf("item:") != 0) return false;
			var itemId = action.substring(5);
			if (!core.canUseItem(itemId)) return false;
			if (core.material.items[itemId].hideInReplay || core.status.replay.speed == 24) {
				core.useItem(itemId, false, core.replay);
				return true;
			}
			core.status.event.id = "toolbox";
			core.initThisEventInfo();
			var info = core.status.thisUIEventInfo;
			var items = core.getToolboxItems("all", core.getFlag('showHideItem', false));
			setPageItems(1);
			var index = items.indexOf(itemId) + 1;
			info.page = Math.ceil(index / info.maxItem);
			info.index = index % info.maxItem || info.maxItem;
			core.setIndexAndSelect("select");
			setPageItems(info.page);
			core.drawToolbox();
			setTimeout(function () {
				core.ui.closePanel();
				core.useItem(itemId, false, core.replay);
			}, core.control.__replay_getTimeout());
			return true;
		}

		core.control._replayAction_equip = function (action) {
			if (action.indexOf("equip:") != 0) return false;
			var itemId = action.substring(6);
			var items = core.getToolboxItems('equips');
			var index = items.indexOf(itemId) + 1;
			if (index < 1) {
				core.removeFlag('__doNotCheckAutoEvents__');
				return false;
			}

			var cb = function () {
				var next = core.status.replay.toReplay[0] || "";
				if (!next.startsWith('equip:') && !next.startsWith('unEquip:')) {
					core.removeFlag('__doNotCheckAutoEvents__');
					core.checkAutoEvents();
				}
				core.replay();
			}
			core.setFlag('__doNotCheckAutoEvents__', true);

			core.status.route.push(action);
			if (core.material.items[itemId].hideInReplay || core.status.replay.speed == 24) {
				core.loadEquip(itemId, cb);
				return true;
			}
			core.status.event.id = "equipbox";
			core.initThisEventInfo();
			var info = core.status.thisUIEventInfo;
			setPageItems(1);
			info.page = Math.ceil(index / info.maxItem);
			info.index = index % info.maxItem || info.maxItem;
			core.setIndexAndSelect("select");
			setPageItems(info.page);
			core.drawEquipbox();
			setTimeout(function () {
				core.ui.closePanel();
				core.loadEquip(itemId, cb);
			}, core.control.__replay_getTimeout());
			return true;
		}

		core.control._replayAction_unEquip = function (action) {
			if (action.indexOf("unEquip:") != 0) return false;
			var equipType = parseInt(action.substring(8));
			if (!core.isset(equipType)) {
				core.removeFlag('__doNotCheckAutoEvents__');
				return false;
			}

			var cb = function () {
				var next = core.status.replay.toReplay[0] || "";
				if (!next.startsWith('equip:') && !next.startsWith('unEquip:')) {
					core.removeFlag('__doNotCheckAutoEvents__');
					core.checkAutoEvents();
				}
				core.replay();
			}
			core.setFlag('__doNotCheckAutoEvents__', true);

			core.status.route.push(action);
			if (core.status.replay.speed == 24) {
				core.unloadEquip(equipType, cb);
				return true;
			}
			core.status.event.id = "equipbox";
			core.initThisEventInfo();
			var info = core.status.thisUIEventInfo;
			setPageItems(1);
			info.select.type = equipType;
			core.setIndexAndSelect();
			core.drawEquipbox();
			setTimeout(function () {
				core.ui.closePanel();
				core.unloadEquip(equipType, cb);
			}, core.control.__replay_getTimeout());
			return true;
		}
		core.registerReplayAction("item", core.control._replayAction_item);
		core.registerReplayAction("equip", core.control._replayAction_equip);
		core.registerReplayAction("unEquip", core.control._replayAction_unEquip);
	},
	"autoChangeEquip":
		function () {
			// 调用方法：在合适的位置调用函数figureEquip即可，例如在脚本编辑-按键处理加入case 89: core.plugin.figureEquip(); break;
			// 即按Y键进入切装模式

			let compareMode = false;
			let equipStatus = [];
			let equipIncluded;

			////// 请在[]中填好不参与换装的装备孔的序号。
			// 例如，0号，4号装备孔不参与换装，则 ignoreList 应设为[0,4]
			// 所有装备孔都参与换装，则 ignoreList 应设为[]
			let ignoreList = [];

			////// 请在{}中根据装备的穿脱事件手动填写装备穿脱时要执行的函数，没有则不填。只填写有效的数值变化即可。
			// 例如:{'sword3':{'equip':function(){core.setFlag('mms3',1);},'unequip':function(){core.setFlag('mms3',0);}}}
			let equipEvents = {};

			function compareEquip() {

				return new Promise(function (res) {

					const canvas = 'compareEquip',
						width = core._PX_ || core.__PIXELS__,
						height = core._PY_ || core.__PIXELS__;

					core.lockControl();

					function finish() {
						compareMode = false;
						core.unregisterAction('onclick', 'bestEquip');
						core.deleteCanvas(canvas);
						res();
					}

					core.createCanvas(canvas, 0, 0, width, height, 160);
					core.setTextAlign(canvas, 'center');
					core.fillText(canvas, '点击选择一个怪物,点击非怪物图块自动退出', width / 2, 20, 'red', '18px Arial');

					core.registerAction('onclick', 'bestEquip', function (x, y, px, py) {
						const cls = core.getBlockCls(x, y),
							id = core.getBlockId(x, y);
						if (!(cls === 'enemys' || cls === "enemy48")) {
							finish();
							return false;
						}
						figureBestEquip(id, x, y);
						core.updateDamage();
						finish();
					}, 100);
				})
			}

			function figureBestEquip(id, x, y) {
				compareMode = true;
				const equipNum = core.status.globalAttribute.equipName.length; // 装备总数量

				// 角色初始各项数值，用于推算出最优切装后复原初始状态
				const oriEffect = {
					'value': { 'atk': core.status.hero.atk, 'def': core.status.hero.def, 'mdef': core.status.hero.mdef, },
					'percentage': { 'atk': core.getBuff('atk'), 'def': core.getBuff('def'), 'mdef': core.getBuff('mdef'), },
					'equipment': core.clone(core.status.hero.equipment),
				}

				if (!equipIncluded) equipIncluded = getEquipIncluded(equipNum);

				const equipIncludedNum = equipIncluded.length;
				const equipNameList = core.status.globalAttribute.equipName.filter((ele, i) => { return !ignoreList.includes(i); });

				equipStatus = equipIncluded.map((ele) => core.getEquip(ele)); //当前参与计算的各个装备孔的装备
				const equipOwned = getEquipOwned(equipNum);
				let equipList = getEquipList(equipIncludedNum, equipOwned, equipNameList);

				const equipCombination = traverseSetCombinations(equipList);

				const bestCombination = findBestEquipComb(equipCombination, equipOwned, id, x, y);

				['atk', 'def', 'mdef'].forEach((ele) => {
					core.setStatus(ele, oriEffect.value[ele]);
					core.setBuff(ele, oriEffect.percentage[ele]);
				});
				core.status.hero.equipment = core.clone(oriEffect.equipment);

				equipBestComb(bestCombination, equipIncluded, equipNameList);
			}

			// 返回一个包含所有参与切装计算的装备孔的序号的数组。
			// 例如，0，2，4号装备孔参与切装计算，则本函数返回[0,2,4]
			function getEquipIncluded(equipNum) {
				let equipIncluded = [];
				for (let i = 0; i < equipNum; i++) {
					if (!ignoreList.includes(i)) equipIncluded.push(i);
				}
				return equipIncluded;
			}

			function getEquipOwned(equipNum) {
				// equipOwned:当前拥有的所有装备的数量
				// 形如{sword1: 2, sword2: 1}
				let equipOwned = core.clone(core.status.hero.items.equips);
				for (let i = 0; i < equipNum; i++) {
					if (ignoreList.includes(i)) continue;
					const currEquip = core.getEquip(i);
					if (currEquip !== null)
						if (equipOwned.hasOwnProperty(currEquip)) equipOwned[currEquip]++;
						else equipOwned[currEquip] = 1;
				}
				return equipOwned;
			}

			// 生成切装列表，为一个二维数组
			function getEquipList(equipNum, equipOwned, equipNameList) {
				// equipNameList:计入切装计算的装备格子的名称列表，可重复
				// 形如['武器', '武器', '盾牌']
				let equipList = Array(equipNameList.length).fill().map(() => new Set([null]));

				//对每个装备孔展开
				for (let i = 0, l = equipNameList.length; i < l; i++) {
					for (let j in equipOwned) {
						let equipType = core.material.items[j].equip.type;
						switch (typeof equipType) {
							case 'number':
								for (let k = 0, l = equipOwned[j]; k < l; k++) { equipList[equipIncluded.indexOf(equipType)].add(j); }
								break;
							case 'string':
								if (equipType === equipNameList[i])
									for (let k = 0, l = equipOwned[j]; k < l; k++) { equipList[i].add(j); }
								break;
						}
					}
				}
				return equipList;
			}

			function traverseSetCombinations(arr) {
				const result = [];
				const currentCombination = [];

				function backtrack(index) {
					if (index === arr.length) {
						result.push([...currentCombination]);
						return;
					}
					const currentSet = Array.from(arr[index]);
					for (let value of currentSet) {
						currentCombination[index] = value;
						backtrack(index + 1);
					}
				}
				backtrack(0);
				return result;
			}

			function getEleCount(ele, arr) {
				let count = 0;
				for (let i = 0, l = arr.length; i < l; i++) {
					if (arr[i] === ele) count++;
				}
				return count;
			}

			function hasEnoughEquip(currComb, equipOwned) {
				for (let i in equipOwned) {
					const equipNeed = getEleCount(i, currComb);
					if (equipOwned[i] < equipNeed) return false;
				}
				return true;
			}

			// 按照给定的列表aimStatus，形如['sword1','sword2',null,'sword1'],修改equipStatus进行模拟切装
			function simulateEquip(equipStatus, aimStatus) {
				equipIncluded.forEach((ele, i) => { core.status.hero.equipment[ele] = aimStatus[i]; })
				for (let i = 0, l = equipStatus.length; i < l; i++) {
					if (equipStatus[i] !== aimStatus[i]) {
						if (aimStatus[i] === null) {
							const unequipId = equipStatus[i];
							if (equipEvents.hasOwnProperty(unequipId) &&
								equipEvents[unequipId].hasOwnProperty('unequip'))
								equipEvents[unequipId].unequip();
							core.items._loadEquipEffect(null, unequipId);
						} else {
							const equipId = aimStatus[i];
							if (equipEvents.hasOwnProperty(equipId) &&
								equipEvents[equipId].hasOwnProperty('equip'))
								equipEvents[equipId].equip();
							core.items._loadEquipEffect(equipId, equipStatus[i]);
						}
						equipStatus[i] = aimStatus[i];
					}
				}
			}

			function findBestEquipComb(equipCombination, equipOwned, id, x, y) {
				let minDamage = core.getDamage(id, x, y),
					bestCombination = core.clone(equipStatus);
				for (let i = 0, l = equipCombination.length; i < l; i++) {
					const currComb = equipCombination[i];
					if (!hasEnoughEquip(currComb, equipOwned)) continue;
					simulateEquip(equipStatus, currComb);
					let damage = core.getDamage(id, x, y);
					if (damage !== null && (minDamage === null || damage < minDamage)) {
						minDamage = damage;
						bestCombination = core.clone(equipStatus);
					}
				}
				return bestCombination;
			}

			function equipBestComb(bestCombination, equipIncluded, equipNameList) {
				const duplicatedName = new Set([]),
					name = core.status.globalAttribute.equipName;

				// 脱下重复装备
				equipNameList.forEach((ele) => {
					if (getEleCount(ele, equipNameList) > 1) duplicatedName.add(ele);
				})
				equipIncluded.forEach((ele) => {
					if (duplicatedName.has(name[ele]) && core.getEquip(ele) !== null) {
						core.unloadEquip(ele);
						core.status.route.push("unEquip:" + ele.toString());
					}
				})

				for (let i = 0, l = bestCombination.length; i < l; i++) {
					const currEquip = bestCombination[i],
						pos = equipIncluded[i];
					if (core.getEquip(pos) === currEquip) continue;
					else if (currEquip === null) {
						core.unloadEquip(pos);
						core.status.route.push("unEquip:" + pos.toString());
					} else {
						core.loadEquip(currEquip);
						core.status.route.push("equip:" + currEquip.toString());
					}
				}
			}

			this.figureEquip = function () {
				compareEquip().then(function (confirm) {
					core.unlockControl();
				})
			}
		},
	"setting": function () {
		// 自绘设置界面
		// 请保持本插件在所有插件的最下方

		class ButtonBase {
			constructor(x, y, w, h) {
				this.x = x;
				this.y = y;
				this.w = w;
				this.h = h;
				this.disable = false;

				/** 所在的Menu，用于触发重绘等事件 */
				this.menu;

				this.draw = (ctx) => { };
				this.event = (x, y, px, py) => { };
				this.status;
			}
		}

		class MenuBase {
			constructor(name) {
				this.name = name;
				this.btnList = new Map();
				this.keyEvent = () => { };
				this.clickEvent = (x, y, px, py) => {
					this.btnList.forEach((btn) => {
						if (btn.disable) return;
						if (px >= btn.x && px <= btn.x + btn.w && py > btn.y && py <= btn.y + btn.h) {
							btn.event(x, y, px, py);
						}
					});
				}
			}

			initBtnList(arr) {
				this.btnList = new Map(arr);
				this.btnList.forEach((button) => {
					button.menu = this;
				})
			}

			drawButtonContent() {
				this.btnList.forEach((button) => {
					if (!button.disable) button.draw(this.name);
				})
			}

			drawContent() {
				core.createCanvas(this.name, 0, 0, core.__PIXELS__, core.__PIXELS__, 136);
				this.drawButtonContent(this.name);
			}

			beginListen() {
				core.registerAction('keyDown', this.name, this.keyEvent, 100);
				core.registerAction('ondown', this.name, this.clickEvent, 100);

			}

			endListen() {
				core.unregisterAction('keyDown', this.name);
				core.unregisterAction('ondown', this.name);
			}

			clear() {
				this.endListen();
				core.deleteCanvas(this.name);
			}

			init() {
				this.beginListen();
				this.drawContent();
			}
		}
		class MenuPage extends MenuBase {
			constructor(pageList, currPage, ctx) {
				super(ctx);
				/**
				 * 当前页面列表
				 * @type {Array<MenuBase>}
				 */
				this.pageList = pageList;
				/**
				 * 当前页的序号
				 * @type {number}
				 */
				this.currPage = currPage | 0;
			}

			initOnePage(index) {
				if (!core.isset(index)) index = this.currPage;
				this.pageList[index].init();
			}

			changePage(num) {
				if (num !== this.currPage) {
					const beforeMenu = this.pageList[this.currPage];
					beforeMenu.clear();
				}
				this.currPage = num;
				this.initOnePage();
			}

			pageDown() {
				if (this.currPage > 0) this.changePage(this.currPage - 1);
			}

			pageUp() {
				if (this.currPage < this.pageList.length - 1) this.changePage(this.currPage + 1);
			}

			clear() {
				this.pageList.forEach((page) => page.clear());
				super.clear();
			}
		}

		class Setting {
			/**
			 * @param {(ctx:string)=>void} draw 
			 */
			constructor(name, effect, text, replay, draw) {
				/** 获取选项界面显示的名称 */
				this.getName = name;
				/** 执行该选项的效果 */
				this.effect = effect;
				/** 该选项在框中的说明文字 */
				this.text = text;
				/** 该选项是否计入录像 
				 * @type {boolean}
				 */
				this.replay = replay;
				/** 除名称外的绘制内容
				 * @type {(ctx:string)=>void}
				 */
				this.draw = draw;
			}
		}

		function invertFlag(name) {
			core.setFlag(name, !core.getFlag(name, false));
		}

		const perform = {
			jumpBlock: core.jumpBlock, jumpHero: core.jumpHero, moveBlock: core.moveBlock,
			drawAnimate: core.drawAnimate, drawHeroAnimate: core.drawHeroAnimate,
			vibrate: core.vibrate, _action_sleep: core.events._action_sleep,
			__action_checkReplaying: core.events.__action_checkReplaying,
		};

		function instantMove(fromX, fromY, aimX, aimY, keep, callback) {
			const [block, blockInfo] = _getAndRemoveBlock(fromX, fromY);
			if (keep) {
				core.setBlock(blockInfo.number, aimX, aimY);
				core.showBlock(aimX, aimY);
			}
			if (callback) callback();
		}

		function skipTextOn() {
			events.prototype.__action_checkReplaying = function () {
				core.doAction();
				return true;
			}
		}

		function skipTextOff() {
			events.prototype.__action_checkReplaying = perform.__action_checkReplaying;
		}

		function skipPeformOn() {
			core.jumpBlock = maps.prototype.jumpBlock = function (sx, sy, ex, ey, time, keep, callback) {
				return instantMove(sx, sy, ex, ey, keep, callback);
			}
			core.jumpHero = maps.prototype.jumpHero = function (ex, ey, time, callback) {
				core.setHeroLoc('x', ex);
				core.setHeroLoc('y', ey);
				core.clearMap('hero');
				core.drawHero();
				if (callback) callback();
			}

			core.moveBlock = maps.prototype.moveBlock = function (x, y, steps, time, keep, callback) {
				perform.moveBlock(x, y, steps, 1, keep, callback);
			}

			core.drawAnimate = maps.prototype.drawAnimate = function (name, x, y, alignWindow, callback) {
				if (callback) callback();
				return -1;
			}

			core.drawHeroAnimate = maps.prototype.drawHeroAnimate = function (name, callback) {
				if (callback) callback();
				return -1;
			}

			core.vibrate = events.prototype.vibrate = function () {
				if (callback) callback();
				return;
			}

			events.prototype._action_sleep = function (data, x, y, prefix) {
				core.doAction();
			}

			events.prototype.__action_checkReplaying = function () {
				core.doAction();
				return true;
			}
		}

		function skipPeformOff() {
			core.jumpBlock = maps.prototype.jumpBlock = perform.jumpBlock;
			core.jumpHero = maps.prototype.jumpHero = perform.jumpHero;
			core.moveBlock = maps.prototype.moveBlock = perform.moveBlock;
			core.drawAnimate = maps.prototype.drawAnimate = perform.drawAnimate;
			core.drawHeroAnimate = maps.prototype.drawHeroAnimate = perform.drawHeroAnimate;
			core.vibrate = events.prototype.vibrate = perform.vibrate;
			events.prototype._action_sleep = perform._action_sleep;
			events.prototype.__action_checkReplaying = perform.__action_checkReplaying;
		}

		const settingMap = new Map([
			['autoGet', new Setting(
				() => '自动拾取:' + (core.getFlag('autoGet', false) ? '开' : '关'),
				() => invertFlag('autoGet'),
				'每走一步，自动拾取当前层可获得的道具。',
				true,
			)],
			['autoBattle', new Setting(
				() => '自动清怪:' + (core.getFlag('autoBattle', false) ? '开' : '关'),
				() => invertFlag('autoBattle'),
				'每走一步，自动和当前层可到达位置伤害为0的敌人战斗。对部分特殊敌人无效。',
				true,
			)],
			['noRouting_HP', new Setting(
				() => '',
				() => invertFlag('noRouting_HP'),
				'自动寻路时绕过加血物品。同时自动拾取也将忽略这类物品。',
				true,
				function (ctx) {
					core.setAlpha(ctx, core.hasFlag('noRouting_HP') ? 1 : 0.3);
					core.drawIcon(ctx, 'redPotion', this.x, this.y, this.w, this.h);
					core.setAlpha(ctx, 1);
				}
			)],
			['noRouting_MDEF', new Setting(
				() => '',
				() => invertFlag('noRouting_MDEF'),
				'自动寻路时绕过加护盾物品。同时自动拾取也将忽略这类物品。',
				true,
				function (ctx) {
					core.setAlpha(ctx, core.hasFlag('noRouting_MDEF') ? 1 : 0.3);
					core.drawIcon(ctx, 'greenGem', this.x, this.y, this.w, this.h);
					core.setAlpha(ctx, 1);
				}
			)],
			['noRouting_ATK', new Setting(
				() => '',
				() => invertFlag('noRouting_ATK'),
				'自动寻路时绕过加攻物品。同时自动拾取也将忽略这类物品。',
				true,
				function (ctx) {
					core.setAlpha(ctx, core.hasFlag('noRouting_ATK') ? 1 : 0.3);
					core.drawIcon(ctx, 'redGem', this.x, this.y, this.w, this.h);
					core.setAlpha(ctx, 1);
				}
			)],
			['noRouting_DEF', new Setting(
				() => '',
				() => invertFlag('noRouting_DEF'),
				'自动寻路时绕过加防物品。同时自动拾取也将忽略这类物品。',
				true,
				function (ctx) {
					core.setAlpha(ctx, core.hasFlag('noRouting_DEF') ? 1 : 0.3);
					core.drawIcon(ctx, 'blueGem', this.x, this.y, this.w, this.h);
					core.setAlpha(ctx, 1);
				}
			)],
			['clickMove', new Setting(
				() => '单击瞬移:' + (core.hasFlag('__noClickMove__') ? '关' : '开'),
				() => invertFlag('__noClickMove__'),
				'系统设置。单击即可触发瞬移。',
				true,
			)],
			['moveSpeedDown', new Setting(
				() => ' < 步时:' + core.values.moveSpeed,
				() => core.actions._clickSwitchs_action_moveSpeed(-10),
				'缩短步时。',
				false,
			)],
			['moveSpeedUp', new Setting(
				() => ' > ',
				() => core.actions._clickSwitchs_action_moveSpeed(10),
				'增大步时。',
				false,
			)],
			['floorChangeTimeDown', new Setting(
				() => ' <   转场:' + core.values.floorChangeTime,
				() => core.actions._clickSwitchs_action_floorChangeTime(-100),
				'缩短转场时间。',
				false, // 录像中不可录入任何DOM操作
			)],
			['floorChangeTimeUp', new Setting(
				() => ' > ',
				() => core.actions._clickSwitchs_action_floorChangeTime(100),
				'增大转场时间。',
				false,
			)],
			['skip', new Setting(
				() => {
					let text = '跳过:';
					switch (core.getFlag('skip')) {
						case 'perform':
							text += '[剧情+演出]';
							break;
						case 'text':
							text += '[剧情]';
							break;
						default:
							text += '无';
							break;
					}
					return text;
				},
				() => {
					const list = [null, 'text', 'perform'];
					const skipMode = core.getFlag('skip', null);
					const index = list.indexOf(skipMode);
					let newIndex = index + 1;
					if (newIndex > list.length - 1) newIndex = 0;
					const newSkipMode = list[newIndex];
					switch (newSkipMode) {
						case 'text':
							skipTextOn();
							break;
						case 'perform':
							skipPeformOn();
							break;
						default:
							skipPeformOff();
							break;
					}
					core.setFlag('skip', newSkipMode);
				},
				'跳过所有对话（可能跳过重要信息，请慎用）。',
				true,
			)],
			['comment', new Setting(
				() => '在线留言:' + (core.hasFlag('comment') ? '开' : '关'),
				() => {
					if (core.hasFlag('comment')) {
						core.setFlag('comment', false);
						core.plugin.clearCommentSign();
					}
					else {
						core.setFlag('comment', true);
						core.plugin.drawCommentSign();
					}
				},
				'在地图上显示玩家的在线留言。',
				true,
			)],
			['itemDetail', new Setting(
				() => '物品显示数据:' + (core.hasFlag('itemDetail') ? '开' : '关'),
				() => invertFlag('itemDetail'),
				'在地图上显示即捡即用道具和装备增加的属性值。',
				true,
			)],
			['zoomIn', new Setting(
				() => ' <   放缩:' + Math.max(core.domStyle.scale, 1) + 'x',
				() => core.actions._clickSwitchs_display_setSize(-1),
				'放缩。',
				false, // 录像中不可录入任何DOM操作
			)],
			['zoomOut', new Setting(
				() => ' > ',
				() => core.actions._clickSwitchs_display_setSize(1),
				'放缩。',
				false,
			)],
			['HDCanvas', new Setting(
				() => '高清画面:' + (core.flags.enableHDCanvas ? '开' : '关'),
				core.actions._clickSwitchs_display_enableHDCanvas,
				'高清画面',
				false,
			)],
			['enableEnemyPoint', new Setting(
				() => '定点怪显:' + (core.flags.enableEnemyPoint ? '开' : '关'),
				core.actions._clickSwitchs_display_enableEnemyPoint,
				'怪物属性定点显示功能，即属性不同的怪物会在怪物手册单列。',
				false,
			)],
			['displayEnemyDamage', new Setting(
				() => '怪物显伤:' + (core.flags.displayEnemyDamage ? '开' : '关'),
				core.actions._clickSwitchs_display_enemyDamage,
				'怪物显伤',
				false,
			)],
			['displayCritical', new Setting(
				() => '临界显伤:' + (core.flags.displayCritical ? '开' : '关'),
				core.actions._clickSwitchs_display_critical,
				'临界显伤',
				false,
			)],
			['displayExtraDamage', new Setting(
				() => '领域显伤:' + (core.flags.displayExtraDamage ? '开' : '关'),
				core.actions._clickSwitchs_display_extraDamage,
				'领域显伤',
				false,
			)],
			['extraDamageType', new Setting(
				() => '领域模式:' + (core.flags.extraDamageType == 2 ? '[最简]' : core.flags.extraDamageType == 1 ? '[半透明]' : '[完整]'),
				core.actions._clickSwitchs_display_extraDamageType,
				'是否显示不可通行地块的领域伤害。',
				false,
			)],
			['autoScale', new Setting(
				() => '自动放缩:' + (core.getLocalStorage('autoScale') ? '开' : '关'),
				() => core.setLocalStorage('autoScale', core.getLocalStorage('autoScale') ? false : true),
				'自动放缩。',
				false,
			)],
			['bgm', new Setting(
				() => '音乐:' + (core.musicStatus.bgmStatus ? '开' : '关'),
				core.actions._clickSwitchs_sounds_bgm,
				'播放背景音乐。',
				false,
			)],
			['se', new Setting(
				() => '音效:' + (core.musicStatus.soundStatus ? '开' : '关'),
				core.actions._clickSwitchs_sounds_se,
				'播放音效。',
				false,
			)],
			['decreaseVolume', new Setting(
				() => " <   音量:" + Math.round(Math.sqrt(100 * core.musicStatus.userVolume)),
				() => core.actions._clickSwitchs_sounds_userVolume(-1),
				'减小音量。',
				false,
			)],
			['increaseVolume', new Setting(
				() => ' > ',
				() => core.actions._clickSwitchs_sounds_userVolume(1),
				'增大音量。',
				false,
			)],
			['leftHand', new Setting(
				() => '左手模式:' + (core.flags.leftHandPrefer ? '开' : '关'),
				() => core.flags.leftHandPrefer = !core.flags.leftHandPrefer,
				'系统设置。左手模式下WASD将用于移动角色，IJKL对应于原始的WASD进行存读档等操作。',
				true,
			)],
			['setHotKey', new Setting(
				() => '',
				function (num) {
					core.utils.myprompt('输入物品名。名称（例如：破墙镐）或英文ID（例如：pickaxe）均可。', null, (value) => {
						const itemInfo = core.material.items;
						if (itemInfo) {
							const aimItem = Object.values(itemInfo).find((item) => item.name === value || item.id === value);
							if (aimItem) {
								if (['constants', 'tools'].includes(aimItem.cls)) {
									core.setFlag('hotkey' + num, aimItem.id);
									this.menu.drawContent();
								}
								else core.drawFailTip('错误：该类型的物品不支持快捷使用!');
							}
							else core.drawFailTip('错误：找不到该名称的物品!');
						}
						else core.drawFailTip('未知错误：core.material.items不存在!');
					});
				},
				'给选定的数字键绑定一个可快捷使用的物品。',
				true,
				function (ctx) {
					const num = this.eventArgs[0];
					const item = core.getFlag('hotkey' + num, null);
					let icon, itemName;
					if (item && core.material.items.hasOwnProperty(item)) {
						icon = item;
						itemName = core.material.items[item].name;
					}
					else {
						switch (num) {
							case 1:
								icon = 'pickaxe';
								itemName = '破墙镐';
								break;
							case 2:
								icon = 'bomb';
								itemName = '炸弹';
								break;
							case 3:
								icon = 'centerFly';
								itemName = '中心飞';
								break;
							case 4:
								itemName = '杂物';
								break;
							case 5:
								itemName = '回退一步';
								break;
							case 6:
								itemName = '撤销回退';
								break;
							case 7:
								itemName = '轻按';
								break;
						}
					}
					let text = '\\i[btn' + num + ']: ';
					if (icon) text += '\\i[' + icon + ']';
					text += itemName;
					core.ui.drawTextContent(ctx, text, {
						left: this.x, top: this.y + 2, maxWidth: 200, fontSize: 16,
					});
				}
			)],
			['clearHotKeys', new Setting(
				() => '',
				function () {
					for (let i = 1; i <= 7; i++) {
						core.setFlag('hotkey' + i, null);
					}
					this.menu.drawContent();
					core.drawSuccessTip('快捷键已重置到默认状态。')
				},
				'重置本页面所有快捷键到默认状态。',
				true,
				function (ctx) {
					core.fillRoundRect(ctx, this.x, this.y, this.w, this.h, 3, ' #D3D3D3');
					core.strokeRoundRect(ctx, this.x, this.y, this.w, this.h, 3, ' #888888');
					core.fillText(ctx, '重置', this.x + 5, this.y + this.h / 2 + 5, ' #333333', '16px Verdana');
				},
			)],
			['wallHacking', new Setting(
				() => ' 穿墙:' + (core.hasFlag('debug_wallHacking') ? '开' : '关'),
				() => {
					core.setFlag('debug', true);
					invertFlag('debug_wallHacking');
				},
				'开启时将始终穿墙并无视各种事件，无论是否按下Ctrl。',
				false,
			)],
			['debug_statusName', new Setting(
				() => core.getFlag('debug_statusName', '??'),
				function () {
					const dictionary = {
						'体力': 'hp', '血量': 'hp', '生命': 'hp', '血': 'hp',
						'体力上限': 'hpmax', '血量上限': 'hpmax', '生命上限': 'hpmax', '血限': 'hpmax',
						'攻击': 'atk', '攻': 'atk', '防御': 'def', '防': 'def',
						'魔防': 'mdef', '护盾': 'mdef', 'mf': 'mdef',
						'金币': 'money', '金钱': 'money', '钱': 'money', '经验': 'exp',
						'魔力': 'mana', '魔': 'mana', '蓝': 'mana',
					}
					core.utils.myprompt('输入要修改的属性名称', null, (value) => {
						const heroStatus = core.status.hero;
						if (dictionary.hasOwnProperty(value)) {
							value = dictionary[value];
						}
						if (heroStatus && heroStatus.hasOwnProperty(value)
							&& ['hp', 'hpmax', 'atk', 'def', 'mdef', 'money', 'exp', 'mana', 'manamax'].includes(value)) {
							core.setFlag('debug_statusName', value);
							this.menu.drawContent();
						}
						else {
							core.drawFailTip('错误：不合法的名称!');
						}
					});
				},
				'',
				false,
				function (ctx) {
					core.strokeRect(ctx, this.x, this.y, this.w, this.h, ' #708090');
				},
			)],
			['debug_statusValue', new Setting(
				() => {
					let value = core.getFlag('debug_statusValue', '??');
					if (typeof value === 'number') return core.formatBigNumber(value, 5);
					else return value;
				},
				function () {
					core.utils.myprompt('输入要修改到的值', null, (value) => {
						value = parseInt(value);
						if (!Number.isNaN(value)) {
							core.setFlag('debug_statusValue', value);
							this.menu.drawContent();
						}
						else {
							core.drawFailTip('错误：不合法的值!');
						}
					});
				},
				'',
				false,
				function (ctx) {
					core.strokeRect(ctx, this.x, this.y, this.w, this.h, ' #708090');
				},
			)],
			['debug_setStatus', new Setting(
				() => '',
				() => {
					const name = core.getFlag('debug_statusName'),
						value = core.getFlag('debug_statusValue');
					if (!(name && core.status.hero && core.status.hero.hasOwnProperty(name))) {
						core.drawFailTip('错误：不合法的名称!');
						return;
					}
					if (!Number.isInteger(value)) {
						core.drawFailTip('错误：不合法的值!');
						return;
					}
					core.setFlag('debug', true);
					core.setStatus(name, value);
					core.updateStatusBar();
					core.drawSuccessTip('设置成功!');
				},
				'将角色状态设为相应值。',
				false,
				function (ctx) {
					core.fillRoundRect(ctx, this.x, this.y, this.w, this.h, 3, ' #D3D3D3');
					core.strokeRoundRect(ctx, this.x, this.y, this.w, this.h, 3, ' #888888');
					core.fillText(ctx, '执行', this.x + 5, this.y + this.h / 2 + 5, ' #333333', '16px Verdana');
				},
			)],
			['debug_itemName', new Setting(
				() => core.getFlag('debug_itemName', '??'),
				function () {
					core.utils.myprompt('输入要修改的物品名称', null, (value) => {
						const itemInfo = core.material.items;
						if (itemInfo) {
							const aimItem = Object.values(itemInfo).find((item) => item.name === value || item.id === value);
							if (aimItem) {
								core.setFlag('debug_itemName', aimItem.id);
								this.menu.drawContent();
								return;
							}
						}
						core.drawFailTip('错误：不合法的名称!');
					});
				},
				'',
				false,
				function (ctx) {
					core.strokeRect(ctx, this.x, this.y, this.w, this.h, ' #708090');
				},
			)],
			['debug_itemValue', new Setting(
				() => core.getFlag('debug_itemValue', '??'),
				function () {
					core.setFlag('debug', true);
					core.utils.myprompt('输入要修改到的值', null, (value) => {
						value = parseInt(value);
						if (!Number.isNaN(value)) {
							core.setFlag('debug_itemValue', value);
							this.menu.drawContent();
						}
						else {
							core.drawFailTip('错误：不合法的值!');
						}
					});
				},
				'',
				false,
				function (ctx) {
					core.strokeRect(ctx, this.x, this.y, this.w, this.h, ' #708090');
				},
			)],
			['debug_setItem', new Setting(
				() => '',
				() => {
					const name = core.getFlag('debug_itemName'),
						value = core.getFlag('debug_itemValue');
					const itemInfo = core.material.items;

					if (name && itemInfo) {
						let itemExist = Object.values(itemInfo).some((item) => item.id === name);
						if (!itemExist) {
							core.drawFailTip('错误：不合法的名称!');
							return;
						}
					}
					else {
						core.drawFailTip('错误：不合法的名称!');
						return;
					}

					if (!Number.isInteger(value)) {
						core.drawFailTip('错误：不合法的值!');
						return;
					}
					core.setFlag('debug', true);
					core.setItem(name, value);
					core.updateStatusBar();
					core.drawSuccessTip('设置成功!');
				},
				'将道具数设为相应值。',
				false,
				function (ctx) {
					core.fillRoundRect(ctx, this.x, this.y, this.w, this.h, 3, ' #D3D3D3');
					core.strokeRoundRect(ctx, this.x, this.y, this.w, this.h, 3, ' #888888');
					core.fillText(ctx, '执行', this.x + 5, this.y + this.h / 2 + 5, ' #333333', '16px Verdana');
				},
			)],
			['debug_flagName', new Setting(
				() => core.getFlag('debug_flagName', '??'),
				function () {
					core.setFlag('debug', true);
					core.utils.myprompt('输入要修改的变量名。注意：如果您不了解修改变量的后果，请勿尝试。', null, (value) => {
						if (!value.startsWith('debug')) {
							core.setFlag('debug_flagName', value);
							this.menu.drawContent();
						}
						else {
							core.drawFailTip('错误：不合法的名称!');
						}
					});
				},
				'',
				false,
				function (ctx) {
					core.strokeRect(ctx, this.x, this.y, this.w, this.h, ' #708090');
				},
			)],
			['debug_flagValue', new Setting(
				() => core.getFlag('debug_flagValue', '??'),
				function () {
					core.setFlag('debug', true);
					core.utils.myprompt('输入要修改到的值。注意：如果您不了解修改变量的后果，请勿尝试。', null, (value) => {
						let newValue;
						try {
							newValue = JSON.parse(value.trim());
						}
						catch {
							core.drawFailTip('错误：不合法的值，无法解析!');
							return;
						}
						core.setFlag('debug_flagValue', newValue);
						this.menu.drawContent();
					});
				},
				'',
				false,
				function (ctx) {
					core.strokeRect(ctx, this.x, this.y, this.w, this.h, ' #708090');
				},
			)],
			['debug_setFlag', new Setting(
				() => '',
				() => {
					const name = core.getFlag('debug_flagName'),
						value = core.getFlag('debug_flagValue');
					if (!name) {
						core.drawFailTip('错误：不合法的变量名称!');
						return;
					}
					core.setFlag('debug', true);
					core.setFlag(name, value);
					core.updateStatusBar();
					core.drawSuccessTip('设置成功!');
				},
				'将变量设为相应值。',
				false,
				function (ctx) {
					core.fillRoundRect(ctx, this.x, this.y, this.w, this.h, 3, ' #D3D3D3');
					core.strokeRoundRect(ctx, this.x, this.y, this.w, this.h, 3, ' #888888');
					core.fillText(ctx, '执行', this.x + 5, this.y + this.h / 2 + 5, ' #333333', '16px Verdana');
				},
			)],
		])

		class SettingButton extends ButtonBase {
			/**
			 * @param {unknown[]} eventArgs 
			 */
			constructor(x, y, w, h, name, eventArgs) {
				super(x, y, w, h);
				this.name = name;
				/**
				 * @type {Array<unknown>}
				 */
				this.eventArgs = eventArgs || [];
				/**
				 * @type {Setting}
				 */
				this.setting = settingMap.get(name);
				this.draw = (ctx) => {
					if (this.disable) return;
					// 取消注释下面这一句将显示所有按钮的判定框
					// core.strokeRect(ctx, this.x, this.y, this.w, this.h, 'yellow');
					core.ui.fillText(ctx, this.setting.getName(),
						this.x, this.y + this.h / 2 + 5, 'white', '16px Verdana');
					const drawFunc = this.setting.draw;
					if (drawFunc) drawFunc.apply(this, [ctx]);
				}
				this.event = () => {
					if (this.disable) return;
					this.setting.effect.apply(this, eventArgs);
					this.menu.drawContent();
					if (this.setting.replay) core.status.route.push('cSet:' + name);
				}
			}
		}

		core.registerReplayAction('cSet', (action) => {
			const strArr = action.split(':');
			if (strArr[0] !== 'cSet') return false;
			const btn = settingMap.get(strArr[1]);
			if (!btn.replay || strArr[1].startsWith('debug')) return false;
			btn.effect();
			core.status.route.push(action);
			core.replay();
			return true;
		})

		function drawSetting(ctx) {
			core.setAlpha(ctx, 0.85);
			core.strokeRoundRect(ctx, 0, 0, core.__PIXELS__, core.__PIXELS__, 5, "#fff", 2);
			core.fillRoundRect(ctx, 0, 0, core.__PIXELS__, core.__PIXELS__, 5, "gray");
			core.setAlpha(ctx, 1);

			// 绘制设置说明的文本框
			core.strokeRoundRect(ctx, 20, 70, core.__PIXELS__ - 40, 70, 3, "white");
			core.fillRoundRect(ctx, 21, 71, core.__PIXELS__ - 42, 68, 3, " #555555");

			// 绘制设置的框体
			core.strokeRoundRect(ctx, 20, 150, core.__PIXELS__ - 40, 240, 3, "white");
			core.fillRoundRect(ctx, 21, 151, core.__PIXELS__ - 42, 238, 3, " #999999");

			core.setTextAlign(ctx, 'center');
			core.ui.fillText(ctx, "设置", core.__PIXELS__ / 2, 25, 'white', '20px Verdana');
		}

		class ChoiceButton extends ButtonBase {
			constructor(x, y, w, h, text, index) {
				super(x, y, w, h);
				this.index = index;
				this.draw = (ctx) => {
					core.setTextAlign(ctx, 'center');
					if (this.status === 'clicked') {
						core.fillRoundRect(ctx, x, y, w, h, 3, ' #ADD8E6');
						core.strokeRoundRect(ctx, x, y, w, h, 3, ' #FFFF00');
						core.fillText(ctx, text, x + w / 2, y + h / 2 + 5, ' #555555', '16px Verdana');
					} else {
						core.fillRoundRect(ctx, x, y, w, h, 3, ' #D3D3D3');
						core.strokeRoundRect(ctx, x, y, w, h, 3, ' #888888');
						core.fillText(ctx, text, x + w / 2, y + h / 2 + 5, ' #333333', '16px Verdana');
					}
				};
			}
		}

		class SettingOnePage extends MenuBase {
			constructor(name) {
				super(name);
				this.text = '';
				this.selectedPos;
				this.selectedBtn;
				this.clickEvent = (x, y, px, py) => {
					this.btnList.forEach((btn, pos) => {
						if (btn.disable) return;
						if (px >= btn.x && px <= btn.x + btn.w && py > btn.y && py <= btn.y + btn.h) {
							if (this.selectedBtn === btn) btn.event(x, y, px, py);
							else {
								this.focus(btn, pos);
							}
						}
					});
				}
				this.keyEvent = (keyCode) => {
					let x, y;
					const changePos = (newPos) => {
						if (this.btnList.has(newPos)) {
							const button = this.btnList.get(newPos);
							this.focus(button, newPos);
						}
					}
					if ([37, 38, 39, 40].includes(keyCode)) {
						if (!this.selectedBtn) {
							const button = this.btnList.get('1,1');
							if (button) this.focus(button, '1,1');
							return;
						}
						else {
							[x, y] = this.selectedPos.split(',').map((x) => parseInt(x));
							if (keyCode === 37) x--;
							if (keyCode === 38) y--;
							if (keyCode === 39) x++;
							if (keyCode === 40) y++;
							let newPos = x + ',' + y;

							// 逻辑：左右，查找不到对应坐标就不动。
							// 上下，查找不到对应坐标，只要该列存在第一个元素，就会移到该列。

							if (keyCode === 37 || keyCode === 39) {
								changePos(newPos);
							}
							if (keyCode === 38 || keyCode === 40) {
								if (this.btnList.has(newPos)) {
									const button = this.btnList.get(newPos);
									this.focus(button, newPos);
								}
								else {
									newPos = '1,' + y;
									changePos(newPos);
								}
							}
						}
					}
					else {
						switch (keyCode) {
							case 13:
							case 32: // Enter/Space
								if (this.selectedBtn) this.selectedBtn.event();
								break;
						}
					}
				}
			}

			focus(button, pos) {
				this.selectedPos = pos;
				this.selectedBtn = button;
				this.text = button.setting.text;
				this.drawEventSelector();
				this.drawContent();
			}

			drawEventSelector() {
				if (core.isset(this.selectedBtn)) {
					core.drawUIEventSelector(0, "winskin.png", this.selectedBtn.x, this.selectedBtn.y,
						this.selectedBtn.w, this.selectedBtn.h, 137);
				}
			}

			drawContent() {
				super.drawContent();
				if (this.text && this.text.length > 0) {
					core.ui.drawTextContent(this.name, this.text, {
						left: 30, top: 78, bold: false, color: "white",
						align: "left", fontSize: 14, maxWidth: 350
					});
				}
				switch (this.name) {
					case 'gamePlay':
						core.fillText(this.name, '-- 自动 --', 40, 175, ' #FFE4B5', '18px Verdana');
						core.fillText(this.name, '-- 瞬移 --', 40, 225, ' #FFE4B5', '18px Verdana');
						core.fillText(this.name, '绕开', 220, 250, 'white', '16px Verdana');
						core.fillText(this.name, '-- 杂项 --', 40, 275, ' #FFE4B5', '18px Verdana');
						break;
					case 'gameView':
						core.fillText(this.name, '-- 显示 --', 40, 175, ' #FFE4B5', '18px Verdana');
						core.fillText(this.name, '-- 音效 --', 40, 320, ' #FFE4B5', '18px Verdana');
						break;
					case 'key':
						core.fillText(this.name, '-- 快捷键设置 --', 40, 205, ' #FFE4B5', '18px Verdana');
						break;
					case 'console':
						const consoleWarnText =
							"本页面的功能仅供调试用。使用后相应存档将变红，录像不能通过，且无法提交。请读档到普通存档后正常游玩方可提交。";
						core.ui.drawTextContent(this.name, consoleWarnText, {
							left: 30, top: 158, bold: false, color: " #FFC0CB",
							align: "left", fontSize: 14, maxWidth: 350
						});
						core.fillText(this.name, "属性", 45, 264, 'white', '16px Verdana');
						core.fillText(this.name, "设为", 170, 264, 'white', '16px Verdana');
						core.fillText(this.name, "物品", 45, 290, 'white', '16px Verdana');
						core.fillText(this.name, "数量设为", 170, 290, 'white', '16px Verdana');
						core.fillText(this.name, "变量", 45, 316, 'white', '16px Verdana');
						core.fillText(this.name, "设为", 170, 316, 'white', '16px Verdana');
						break;
				}
				this.drawEventSelector();
			}

			clear() {
				core.clearUIEventSelector(0);
				super.clear();
			}
		}

		class SettingMenu extends MenuPage {
			constructor(pageList, currPage, name) {
				super(pageList, currPage, name);
				this.keyEvent = (keyCode) => {
					if (keyCode === 33) this.pageUp();
					if (keyCode === 34) this.pageDown();
					if ([33, 34].includes(keyCode)) {
						const btn = this.btnList.get(this.currPage);
						this.changeBtn(btn);
						this.drawContent();
					}
					if (keyCode === 27) {
						this.btnList.get('quit').event();
					}
				}
			}

			initBtnList(arr) {
				super.initBtnList(arr);
				this.btnList.forEach((btn) => {
					if (btn instanceof ChoiceButton) {
						btn.event = function () {
							this.menu.changePage(this.index);
							this.menu.changeBtn(this);
							this.menu.drawContent();
						}
					}
				});
			}

			drawContent() {
				core.createCanvas(this.name, 0, 0, core.__PIXELS__, core.__PIXELS__, 136);
				drawSetting(this.name);
				super.drawButtonContent();
				this.initOnePage();
			}

			changeBtn(aimBtn) {
				this.btnList.forEach((btn) => {
					if (btn instanceof ChoiceButton) {
						btn.status = aimBtn === btn ? 'clicked' : 'pending';
					}
				})
			}
		}

		class TextButton extends ButtonBase {
			constructor(x, y, w, h, text) {
				super(x, y, w, h);
				this.draw = (ctx) => {
					if (this.disable) return;
					core.ui.fillText(ctx, text,
						this.x + this.w / 2, this.y + this.h / 2 + 5, 'white', '16px Verdana');
				}
			}
		}

		this.openSetting = function () {
			if (core.isReplaying()) return;
			core.lockControl();
			const ctx = 'setting';

			// 每个页面的按钮
			const gamePlayMenu = new SettingOnePage('gamePlay');
			gamePlayMenu.initBtnList([
				['1,1', new SettingButton(40, 180, 150, 30, 'autoGet')],
				['2,1', new SettingButton(220, 180, 150, 30, 'autoBattle')],
				['1,2', new SettingButton(40, 230, 150, 30, 'clickMove')],
				['2,2', new SettingButton(260, 234, 24, 24, 'noRouting_HP')],
				['3,2', new SettingButton(290, 234, 24, 24, 'noRouting_MDEF')],
				['4,2', new SettingButton(320, 234, 24, 24, 'noRouting_ATK')],
				['5,2', new SettingButton(350, 234, 24, 24, 'noRouting_DEF')],
				['1,3', new SettingButton(40, 280, 25, 25, 'moveSpeedDown')],
				['2,3', new SettingButton(140, 280, 25, 25, 'moveSpeedUp')],
				['3,3', new SettingButton(220, 280, 25, 25, 'floorChangeTimeDown')],
				['4,3', new SettingButton(340, 280, 25, 25, 'floorChangeTimeUp')],
				['1,4', new SettingButton(40, 305, 150, 25, 'skip')],
				['2,4', new SettingButton(220, 305, 150, 25, 'comment')],
			]);

			const gameViewMenu = new SettingOnePage('gameView');
			gameViewMenu.initBtnList([
				['1,1', new SettingButton(40, 180, 150, 25, 'itemDetail')],
				['1,2', new SettingButton(40, 205, 150, 25, 'HDCanvas')],
				['1,3', new SettingButton(40, 230, 150, 25, 'displayEnemyDamage')],
				['1,4', new SettingButton(40, 255, 150, 25, 'displayExtraDamage')],
				['1,5', new SettingButton(40, 280, 150, 25, 'extraDamageType')],
				['1,6', new SettingButton(40, 325, 150, 25, 'bgm')],
				['1,7', new SettingButton(40, 350, 25, 25, 'decreaseVolume')],
				['2,7', new SettingButton(140, 350, 25, 25, 'increaseVolume')],

				['2,1', new SettingButton(220, 180, 25, 25, 'zoomIn')],
				['3,1', new SettingButton(320, 180, 25, 25, 'zoomOut')],
				['2,2', new SettingButton(220, 205, 150, 25, 'autoScale')],
				['2,3', new SettingButton(220, 230, 150, 25, 'enableEnemyPoint')],
				['2,4', new SettingButton(220, 255, 150, 25, 'displayCritical')],
				['2,6', new SettingButton(220, 325, 150, 25, 'se')],
			]);

			const keyMenu = new SettingOnePage('key');
			keyMenu.initBtnList([
				['1,1', new SettingButton(40, 160, 150, 25, 'leftHand')],
				['1,2', new SettingButton(40, 220, 150, 25, 'setHotKey', [1])],
				['2,2', new SettingButton(220, 220, 150, 25, 'setHotKey', [2])],
				['1,3', new SettingButton(40, 250, 150, 25, 'setHotKey', [3])],
				['2,3', new SettingButton(220, 250, 150, 25, 'setHotKey', [4])],
				['1,4', new SettingButton(40, 280, 150, 25, 'setHotKey', [5])],
				['2,4', new SettingButton(220, 280, 150, 25, 'setHotKey', [6])],
				['1,5', new SettingButton(40, 310, 150, 25, 'setHotKey', [7])],
				['1,6', new SettingButton(300, 350, 42, 25, 'clearHotKeys')],
			]);

			const consoleMenu = new SettingOnePage('console');
			consoleMenu.initBtnList([
				['1,1', new SettingButton(40, 220, 150, 25, 'wallHacking')],
				['1,2', new SettingButton(80, 250, 80, 20, 'debug_statusName')],
				['2,2', new SettingButton(210, 250, 80, 20, 'debug_statusValue')],
				['3,2', new SettingButton(340, 250, 40, 20, 'debug_setStatus')],
				['1,3', new SettingButton(80, 276, 80, 20, 'debug_itemName')],
				['2,3', new SettingButton(240, 276, 80, 20, 'debug_itemValue')],
				['3,3', new SettingButton(340, 276, 40, 20, 'debug_setItem')],
				['1,4', new SettingButton(80, 302, 80, 20, 'debug_flagName')],
				['2,4', new SettingButton(210, 302, 80, 20, 'debug_flagValue')],
				['3,4', new SettingButton(340, 302, 40, 20, 'debug_setFlag')],
			]);

			// 在此处添加新的菜单页面
			const settingMenu = new SettingMenu([gamePlayMenu, gameViewMenu, keyMenu, consoleMenu], 0, ctx);

			// 主页面的按钮列表
			const gamePlayBtn = new ChoiceButton(32, 40, 46, 24, '功能', 0),
				gameViewBtn = new ChoiceButton(92, 40, 46, 24, '音画', 1),
				keyBtn = new ChoiceButton(152, 40, 46, 24, '按键', 2),
				consoleBtn = new ChoiceButton(212, 40, 66, 24, '控制台', 3);
			const quit = new TextButton(360, 10, 45, 25, '[退出]');
			quit.event = () => {
				settingMenu.clear();
				setTimeout(core.unlockControl, 0); // 消抖，防止点击关闭按钮的一瞬间触发瞬移。
			}

			settingMenu.initBtnList([[0, gamePlayBtn], [1, gameViewBtn],
			[2, keyBtn], [3, consoleBtn],
			['quit', quit]]);

			// 设置初始时选中的按键为第一个按键
			settingMenu.changeBtn(gamePlayBtn);

			settingMenu.init();
		}
	}
}