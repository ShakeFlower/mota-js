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
	class j extends F {
		constructor() {
			super();
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
		Ticker: O,
		Transition: j,
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
						x > core.bigmap.posX + core._SIZE_ + core.bigmap.extend ||
						y < core.bigmap.posY - core.bigmap.extend ||
						y > core.bigmap.posY + core._SIZE_ + core.bigmap.extend
					) {
						return;
					}
				}
				diff = {};
				const id = block.event.id;
				const item = core.material.items[id];
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
						color = '#FF7A7A';
						break;
					case 'def':
					case 'defper':
						color = '#00E6F1';
						break;
					case 'mdef':
					case 'mdefper':
						color = '#6EFF83';
						break;
					case 'hp':
						color = '#A4FF00';
						break;
					case 'hpmax':
					case 'hpmaxper':
						color = '#F9FF00';
						break;
					case 'mana':
						color = '#c66';
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
    "autoGet": function () {
		// 在此增加新插件

	},
    "newBackPackLook": function () {
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
		this.drawBoxBackground = function (ctx) {
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
			var arrow_lineWidth = 1;
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

			core.drawItemListbox_setPageBtn(ctx, pageBtn_left, pageBtn_right, pageBtn_bottom, pageBtn_radius, pageBtn_borderStyle, pageBtn_borderWidth);
			var page = info.page || 1;
			var pageFontSize = pageBtn_radius * 2 - 4;
			var pageFont = core.ui._buildFont(pageFontSize);
			core.setPageItems(page);
			var num = itemNum;
			if (core.status.event.id == "equipbox") num -= 5;
			var maxPage = info.maxPage;
			var pageText = page + " / " + maxPage;
			core.setTextAlign(ctx, "center");
			core.setTextBaseline(ctx, "bottom");
			core.fillText(ctx, pageText, (leftbar_x + leftbar_right) / 2, pageBtn_bottom, pageText_color, pageFont);
			core.addUIEventListener(start_x, start_y, leftbar_right - start_x, arrow_y - start_y + 13, changeBox);
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

		this.drawItemListbox = function (ctx, obj) {
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
			var pageItems = core.setPageItems(page);
			var marginHeight = itembar_marginHeightRatio * oneItemHeight;
			core.setTextBaseline(ctx, "middle");
			var originColor = itemName_color;
			for (var i = 0; i < pageItems.length; i++) {
				itemName_color = originColor;
				var item = pageItems[i];
				// 设置某个的字体颜色的一个例子
				// if (item.id == "xxx") itemName_color = "green";
				core.drawItemListbox_drawItem(ctx, item_x, item_right, item_y, oneItemHeight, item_marginLeft, marginHeight, itemName_color, pageItems[i]);
				if (index == i + 1) core.ui._drawWindowSelector(item_selector, item_x + 1, item_y - 1, item_right - item_x - 2, oneItemHeight - 2);
				item_y += oneItemHeight;
			}
		}

		this.drawToolboxRightbar = function (ctx, obj) {
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
			core.drawToolbox_setExitBtn(ctx, btn_x, btn_y, btnRadius, btnBorderStyle, btnBorderWidth);

			///// *** 使用按钮设置
			var useBtnHeight = btnRadius * 2;
			// 这里不设置useBtnWidth而是根据各项数据自动得出width
			var useBtnRadius = useBtnHeight / 2;
			var useBtn_x = rightbar_x + 4,
				useBtn_y = btnBottom - useBtnHeight;
			var useBtnBorderStyle = "#fff";
			var useBtnBorderWidth = btnBorderWidth;
			///// ***

			core.drawToolbox_setUseBtn(ctx, useBtn_x, useBtn_y, useBtnRadius, useBtnHeight, useBtnBorderStyle, useBtnBorderWidth);
		}

		this.drawEquipbox_drawOthers = function (ctx, obj) {
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
				core.drawEquipbox_drawOne(ctx, name, id, box_x, box_y, box_width, box_height, boxName_space, boxName_font, boxName_color, borderStyle, box_borderWidth);
				var todo = new Function("core.clickOneEquipbox('" + id + "'," + i + ")");
				core.addUIEventListener(box_x - box_borderWidth / 2, box_y - box_borderWidth / 2, oneBoxWidth, oneBoxHeight, todo);
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

			var info = core.drawBoxBackground(ctx);
			info.itemNum = itemNum;
			core.drawItemListbox(ctx, info.obj);
			core.drawToolboxRightbar(ctx, info);
			core.setTextBaseline(ctx, "alphabetic");
			core.setTextAlign("left");
		}

		var reduceItem = 4;
		this.drawEquipbox = function (ctx) {
			ctx = ctx || core.canvas.ui;
			core.status.thisEventClickArea = [];
			var info = core.drawBoxBackground(ctx);
			info.itemNum = itemNum - reduceItem;
			info.obj.y += info.obj.oneItemHeight * reduceItem;
			info.obj.height -= info.obj.oneItemHeight * reduceItem;
			core.drawItemListbox(ctx, info.obj);
			core.drawEquipbox_drawOthers(ctx, info);
			core.drawToolboxRightbar(ctx, info);
			core.setTextBaseline(ctx, "alphabetic");
			core.setTextAlign("left");
		}


		this.drawEquipbox_drawOne = function (ctx, name, id, x, y, width, height, space, font, color, style, lineWidth) {
			if (id) core.drawIcon(ctx, id, x + lineWidth / 2, y + lineWidth / 2, width, height);
			core.strokeRect(ctx, x, y, width + lineWidth, height + lineWidth, style, lineWidth);
			core.setTextAlign(ctx, "center");
			core.setTextBaseline(ctx, "top");
			var tx = (x + x + lineWidth / 2 + width) / 2,
				ty = y + height + lineWidth / 2 * 3 + space;
			core.fillText(ctx, name, tx, ty, color, font);
			core.setTextBaseline(ctx, "alphabetic");
			core.setTextAlign("left");
		}

		this.drawItemListbox_drawItem = function (ctx, left, right, top, height, marginLeft, marginHeight, style, id) {
			var info = core.status.thisUIEventInfo;
			var nowClick = info.index;
			var item = core.material.items[id] || {};
			var name = item.name || "???";
			var num = core.itemCount(id) || 0;
			var fontSize = Math.floor(height - marginHeight * 2);
			core.setTextAlign(ctx, "right");
			var numText = "x" + num;
			core.fillText(ctx, numText, right - marginLeft, top + height / 2, style, core.ui._buildFont(fontSize));
			if (name != "???") core.drawIcon(ctx, id, left + marginLeft, top + marginHeight, fontSize, fontSize);
			var text_x = left + marginLeft + fontSize + 2;
			var maxWidth = right - core.calWidth(ctx, numText) - text_x;
			core.setTextAlign(ctx, "left");
			core.fillText(ctx, name, text_x, top + height / 2, style, core.ui._buildFont(fontSize), maxWidth);
			var todo = new Function("core.clickItemFunc('" + id + "');");
			core.addUIEventListener(left, top, right - left, height, todo);
		}

		this.setPageItems = function (page) {
			var num = itemNum;
			if (core.status.event.id == "equipbox") num -= reduceItem;
			var info = core.status.thisUIEventInfo;
			if (!info) return;
			page = page || info.page;
			var items = core.getToolboxItems(core.status.event.id == "toolbox" ? "all" : "equips");
			info.allItems = items;
			var maxPage = Math.ceil(items.length / num);
			info.maxPage = maxPage;
			var pageItems = items.slice((page - 1) * num, page * num);
			info.pageItems = pageItems;
			info.maxItem = pageItems.length;
			if (items.length == 0 && pageItems.length == 0) info.index = null;
			if (pageItems.length == 0 && info.page > 1) {
				info.page = Math.max(1, info.page - 1);
				return core.setPageItems(info.page);
			}
			return pageItems;
		}

		this.drawToolbox_setExitBtn = function (ctx, x, y, r, style, lineWidth) {
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
			core.addUIEventListener(x - r, y - r, r * 2, r * 2, todo);
		}

		this.drawToolbox_setUseBtn = function (ctx, x, y, r, h, style, lineWidth) {
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
			core.addUIEventListener(x, y, w, h, todo);
		}

		this.drawItemListbox_setPageBtn = function (ctx, left, right, bottom, r, style, lineWidth) {
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
			core.addUIEventListener(x - r - 2, y - r - 2, r * 2 + 4, r * 2 + 4, todo);

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
			core.addUIEventListener(x - r - 2, y - r - 2, r * 2 + 4, r * 2 + 4, todo);
		}

		this.clickItemFunc = function (id) {
			var info = core.status.thisUIEventInfo;
			if (!info) return;
			if (info.select.id == id) return core.useSelectItemInBox();
			info.select = {};
			info.select.id = id;
			core.setIndexAndSelect('index');
			core.refreshBox();
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
			return core.refreshBox();
		}

		core.ui.getToolboxItems = function (cls) {
			var list = Object.keys(core.status.hero.items[cls] || {});
			if (cls == "all") {
				for (var name in core.status.hero.items) {
					if (name == "equips") continue;
					list = list.concat(Object.keys(core.status.hero.items[name]));
				}
				return list.filter(function (id) {
					return !core.material.items[id].hideInToolbox;
				}).sort();
			}

			if (this.uidata.getToolboxItems) {
				return this.uidata.getToolboxItems(cls);
			}
			return list.filter(function (id) {
				return !core.material.items[id].hideInToolbox;
			}).sort();
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
			core.setPageItems(info.page);
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
			core.setPageItems(info.page);
			core.setIndexAndSelect("select");
			core.refreshBox();
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
			core.refreshBox();
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
				core.refreshBox();
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
					return core.refreshBox();
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

		this.addUIEventListener = function (x, y, width, height, todo) {
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

		this.refreshBox = function () {
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
			var items = core.getToolboxItems("all");
			core.setPageItems(1);
			var index = items.indexOf(itemId) + 1;
			info.page = Math.ceil(index / info.maxItem);
			info.index = index % info.maxItem || info.maxItem;
			core.setIndexAndSelect("select");
			core.setPageItems(info.page);
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
			if (index < 1) return false;
			core.status.route.push(action);
			if (core.material.items[itemId].hideInReplay || core.status.replay.speed == 24) {
				core.loadEquip(itemId, core.replay);
				return true;
			}
			core.status.event.id = "equipbox";
			core.initThisEventInfo();
			var info = core.status.thisUIEventInfo;
			core.setPageItems(1);
			info.page = Math.ceil(index / info.maxItem);
			info.index = index % info.maxItem || info.maxItem;
			core.setIndexAndSelect("select");
			core.setPageItems(info.page);
			core.drawEquipbox();
			setTimeout(function () {
				core.ui.closePanel();
				core.loadEquip(itemId, core.replay);
			}, core.control.__replay_getTimeout());
			return true;
		}

		core.control._replayAction_unEquip = function (action) {
			if (action.indexOf("unEquip:") != 0) return false;
			var equipType = parseInt(action.substring(8));
			if (!core.isset(equipType)) return false;
			core.status.route.push(action);
			if (core.status.replay.speed == 24) {
				core.unloadEquip(equipType, core.replay);
				return true;
			}
			core.status.event.id = "equipbox";
			core.initThisEventInfo();
			var info = core.status.thisUIEventInfo;
			core.setPageItems(1);
			info.select.type = equipType;
			core.setIndexAndSelect();
			core.drawEquipbox();
			setTimeout(function () {
				core.ui.closePanel();
				core.unloadEquip(equipType, core.replay);
			}, core.control.__replay_getTimeout());
			return true;
		}
		core.registerReplayAction("item", core.control._replayAction_item);
		core.registerReplayAction("equip", core.control._replayAction_equip);
		core.registerReplayAction("unEquip", core.control._replayAction_unEquip);
	},
    "MenuBase": function () {
		// 本插件定义了一些用于绘制的基类
		class ButtonBase {
			constructor(x, y, w, h) {
				this.x = x;
				this.y = y;
				this.w = w;
				this.h = h;
				this.disable = false;

				this.draw = () => { };
				this.event = (x, y, px, py) => { };
				this.status;
			}

			register() {
				core.registerAction('onclick', this.name, (x, y, px, py) => {
					if (this.disable) return;
					if (px >= this.x && px <= this.x + this.w && py > this.y && py <= this.y + this.h)
						this.event(x, y, px, py);
				}, 100);
			}

			unregister() {
				core.unregisterAction('onclick', this.name);
			}
		}

		class MenuBase {
			constructor(name) {
				this.name = name;
				this.btnList = new Map();
				this.keyEvent = () => { };
				this.end = () => { core.clearMap(this.name); };
			}

			drawContent() {
				this.btnList.forEach((button) => { if (!button.disable) button.draw(); })
			}

			beginListen() {
				core.registerAction('keyDown', this.name, this.keyEvent, 100);
				this.btnList.forEach((button) => { button.register(); })
			}

			endListen() {
				core.unregisterAction('keyDown', this.name);
				this.btnList.forEach((button) => { button.unregister(); })
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
			constructor(pageMax, currPage) {
				this.pageMax = pageMax;
				this.currPage = currPage | 0;
				this.pageList = [];
			}

			initOnePage() {
				this.pageList[this.currPage].init();
			}

			changePage(num) {
				if (num !== this.currPage) {
					const beforeMenu = this.pageList[this.currPage];
					beforeMenu.clear();
				}
				this.initOnePage(this.pageList[num]);
				this.currPage = num;
			}

			pageDown() {
				if (this.currPage > 0) this.changePage(this.currPage - 1);
			}

			pageUp() {
				if (this.currPage < this.pageMax - 1) this.changePage(this.currPage + 1);
			}
		}

		this.MenuBase = { ButtonBase, MenuBase, MenuPage };
	},
    "scrollingText": function () {
		// 本插件用于绘制在线留言

	},
    "setting": function () {
		// 设置界面绘制
		// core.openSettings = ...

		this.t = function () {
			const { ButtonBase, MenuBase, MenuPage } = this.MenuBase;

			const ctx = 'setting';

			function drawSetting(ctx) {
				core.createCanvas(ctx, 0, 0, core.__PIXELS__, core.__PIXELS__, 136);
				core.clearMap(ctx);
				core.setAlpha(ctx, 0.85);
				core.strokeRoundRect(ctx, 0, 0, core.__PIXELS__, core.__PIXELS__, 5, "#fff", 2);
				core.fillRoundRect(ctx, 0, 0, core.__PIXELS__, core.__PIXELS__, 5, "gray");
				core.setAlpha(ctx, 1);
				core.strokeRoundRect(ctx, 20, 40, core.__PIXELS__ - 40, 70, 3, "white");
				core.fillRoundRect(ctx, 21, 41, core.__PIXELS__ - 42, 68, 3, "#555555");
				core.setTextAlign(ctx, 'center');
				core.ui.fillText(ctx, "设置", core.__PIXELS__ / 2, 25, 'white', '20px Verdana');
			}

			class SettingMenu extends MenuBase {
				drawContent() {
					drawSetting(ctx);
				}
			}

			const settingMenu = new SettingMenu();

			settingMenu.init();



		}
	}
}