// @ts-check
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
			const canvas = document.createElement('canvas');
			canvas.id = name;
			canvas.className = 'gameCanvas';
			// 编辑器模式下设置zIndex会导致加入的图层覆盖优先级过高
			if (main.mode != "editor") canvas.style.zIndex = zIndex || 0;
			// 将图层插入进游戏内容
			document.getElementById('gameDraw')?.appendChild(canvas);
			const ctx = canvas.getContext('2d');
			if (ctx) core.canvas[name] = ctx;
			canvas.width = core.__PIXELS__;
			canvas.height = core.__PIXELS__;
			return canvas;
		}

		const bg2Canvas = createCanvas('bg2', 20);
		const fg2Canvas = createCanvas('fg2', 63);
		// 大地图适配
		core.bigmap.canvas = ["bg2", "fg2", "bg", "event", "event2", "fg", "damage"];
		core.initStatus.bg2maps = {};
		core.initStatus.fg2maps = {};

		if (main.mode == 'editor') {
			/*插入编辑器的图层 不做此步新增图层无法在编辑器显示*/
			// 编辑器图层覆盖优先级 eui > efg > fg(前景层) > event2(48*32图块的事件层) > event(事件层) > bg(背景层)
			// 背景层2(bg2) 插入事件层(event)之前(即bg与event之间)
			if (bg2Canvas) document.getElementById('mapEdit')?.insertBefore(bg2Canvas, document.getElementById('event'));
			// 前景层2(fg2) 插入编辑器前景(efg)之前(即fg之后)
			if (fg2Canvas) document.getElementById('mapEdit')?.insertBefore(fg2Canvas, document.getElementById('ebm'));
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
			const createCanvasBtn = function (name) {
				// 电脑端创建按钮
				const input = document.createElement('input');
				// layerMod4/layerMod5
				const id = 'layerMod' + num++;
				// bg2map/fg2map
				const value = name + 'map';
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

			const createCanvasBtn_mobile = function (name) {
				// 手机端往选择列表中添加子选项
				const input = document.createElement('option');
				const id = 'layerMod' + num++;
				const value = name + 'map';
				input.name = 'layerMod';
				input.value = value;
				editor.dom[id] = input;
				return input;
			};
			if (!editor.isMobile) {
				const input = createCanvasBtn('bg2');
				const input2 = createCanvasBtn('fg2');
				// 获取事件层及其父节点
				const child = document.getElementById('layerMod'),
					parent = child?.parentNode;
				if (parent) {
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
				}
			} else {
				const input = createCanvasBtn_mobile('bg2');
				const input2 = createCanvasBtn_mobile('fg2');
				// 手机端因为是选项 所以可以直接改innerText
				input.innerText = '背景层2';
				input2.innerText = '前景层2';
				const parent = document.getElementById('layerMod');
				if (parent) {
					parent.insertBefore(input, parent.children[1]);
					parent.appendChild(input2);
				}
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

		// @todo 测试五图层插件在此处是否表现正常
		// @todo 五图层配合autotile是否有bug 待测试
		// 楼层贴图绘制
		core.maps._drawFloorImage = function (ctx, name, one, image, currStatus, onMap) {
			var height = image.height;
			var imageName = one.name + (one.reverse || '');
			var width = parseInt((one.w == null ? image.width : one.w) / (one.frame || 1));
			var height = one.h == null ? image.height : one.h;
			var sx = (one.sx || 0) + (currStatus || 0) % (one.frame || 1) * width;
			var sy = one.sy || 0;
			var x = one.x || 0, y = one.y || 0;
			if (onMap && core.bigmap.v2) {
				if (x > 32 * core.bigmap.posX + core.__PIXELS__ + 32 || x + width < 32 * core.bigmap.posX - 32
					|| y > 32 * core.bigmap.posX + core.__PIXELS__ + 32 || y + height < 32 * core.bigmap.posY - 32) {
					return;
				}
				x -= 32 * core.bigmap.posX;
				y -= 32 * core.bigmap.posY;
			}

			if (one.canvas != 'auto' && one.canvas != name) return;
			if (one.canvas != 'auto') {
				if (currStatus != null) core.clearMap(ctx, x, y, width, height);
				core.drawImage(ctx, imageName, sx, sy, width, height, x, y, width, height);
			} else {
				if (name === 'bg' || name === 'bg2') {
					if (currStatus != null) core.clearMap(ctx, x, y + height - 32, width, 32);
					core.drawImage(ctx, imageName, sx, sy + height - 32, width, 32, x, y + height - 32, width, 32);
				} else if (name == 'fg' || name === 'fg2') {
					if (currStatus != null) core.clearMap(ctx, x, y, width, height - 32);
					core.drawImage(ctx, imageName, sx, sy, width, height - 32, x, y, width, height - 32);
				}
			}
		}
	},
	"itemShop": function () {
		// 道具商店相关的插件
		// 可在全塔属性-全局商店中使用「道具商店」事件块进行编辑（如果找不到可以在入口方块中找）

		var shopId = null; // 当前商店ID
		var type = 0; // 当前正在选中的类型，0买入1卖出
		/** 当前正在选中的道具
		 * @type {number | null} 
		 */
		var selectItem = 0;
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
			core.control.playSound = function () { return undefined; };
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
				if (name == "items") {
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
			this.tickerSet = new Set();
			this.deleteAllAnis = () => { };
			return;
		}

		/** 该集合中的所有Ticker在跨层时需要被摧毁 */
		this.tickerSet = new Set();

		/** 对Map中所有Ticker执行摧毁事件 */
		this.deleteAllAnis = function () {
			core.plugin.tickerSet.forEach((ticker) => ticker.destroy());
		}

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

		/** Ticker类 */
		class I {
			constructor() {
				this.funcs = /* @__PURE__ */ new Set();
				this.status = "stop";
				this.startTime = 0;
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
				core.plugin.tickerSet.delete(this);
				this.clear(), this.stop();
			}
			stop() {
				this.status = "stop", w = w.filter((i) => i !== this);
			}
		}
		/** AnimationBase类 */
		class F {
			constructor() {
				this.timing = Date.now;
				this.relation = "absolute";
				this.easeTime = 0;
				this.applying = {};
				this.getTime = Date.now;
				const ticker = new I();
				this.ticker = ticker;
				this.value = {};
				this.listener = {};
				this.timing = (i) => i;
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
		/** Animation类 */
		class j extends F {
			constructor() {
				super();
				this.shakeTiming;
				this.path;
				this.multiTiming;
				this.value = {};
				this.size = 1;
				this.angle = 0;
				this.targetValue = {
					system: {
						move: [0, 0],
						moveAs: [0, 0],
						resize: 0,
						rotate: 0,
						shake: 0,
						/** @type {number[]} */"@@bind": []
					},
					custom: {}
				};
				this.animateFn = {
					system: {
						move: [() => { }, () => { }],
						moveAs: () => { },
						resize: () => { },
						rotate: () => { },
						shake: () => { },
						"@@bind": () => { }
					},
					custom: {}
				};
				this.ox = 0;
				this.oy = 0;
				this.sx = 0;
				this.sy = 0;
				this.bindInfo = [];
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
				this.now = {};
				this.target = {};
				this.transitionFn = {};
				this.value = undefined;
				this.handleSet = (t, e, s) => (this.transition(e, s), !0);
				this.handleGet = (t, e) => this.now[e];
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
		/** @param {(input:number) => number} [i=() => 1] */
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
			if (!core.isReplaying()) core.getItemDetail(floorId); // 宝石血瓶详细信息
			this.drawDamage(ctx);
		};

		function getRatio() {
			let ratio = (core.status.thisMap?.ratio) ?? 1;
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
				switch (item.cls) {
					case 'equips': {
						// 装备也显示
						diff = item.equip.value ?? {};
						const per = item.equip.percentage ?? {};
						for (const name in per) {
							diff[name + 'per'] = per[name].toString() + '%';
						}
						break;
					}
					case 'items': {
						// 跟数据统计原理一样 执行效果 前后比较
						core.setFlag('__statistics__', true);
						try {
							eval(item.itemEffect);
						} catch (error) { }
						const ratio = getRatio();
						const effectObj = core.getItemEffectValue(id, ratio);
						for (let statusName in effectObj) {
							if (!effectObj.hasOwnProperty(statusName)) continue;
							if (!diff.hasOwnProperty(statusName)) diff[statusName] = 0;
							diff[statusName] += effectObj[statusName];
						}
						break;
					}
				}
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
		const transitionTime = 400;

		const transitionList = [];

		const ctxName = 'autoClear';

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
			if (!has(block)) { // 说明什么都没有，没事件也没图块
				return { type: "none", canGoThrough: true };
			}
			const cls = block.event.cls;
			const loc = `${tx},${ty}`;
			const floor = core.floors[floorId];
			const changeFloor = floor.changeFloor[loc];
			const isEnemy = autoBattle && cls.startsWith('enemy'),
				isItem = autoGet && cls === 'items';
			// 因为没有判定往来图块的通行性，这里宁可严格一点，非空地(block.id === 0)一律不给穿
			if (has(changeFloor)) {
				if ((changeFloor.ignoreChangeFloor ?? core.flags.ignoreChangeFloor) && block.id === 0) {
					return { type: "unknown", canGoThrough: true };
				}
				return { type: "unknown", canGoThrough: false };
			}

			if (has(core.floors[floorId].events[loc])) return { type: "unknown", canGoThrough: false };

			if (isEnemy) return { type: "enemy", canGoThrough: true };
			if (isItem) return { type: "item", canGoThrough: true };

			return { type: "unknown", canGoThrough: false };
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
			const dir = /** @type {[direction, number, number][]} */Object.entries(core.utils.scan).map(v => [v[0], v[1].x, v[1].y]);
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
					const block = objs[loc];
					mapped[loc] = true;
					if (core.onSki(bgMap[ty][tx])) return; // bfs不允许穿过滑冰
					const { type, canGoThrough } = judge(block, nx, ny, tx, ty, v[0], floorId, autoBattle, autoGet);
					if (!canGoThrough) return;

					if (type === 'enemy') {
						if (canBattle(block.event.id, tx, ty) && !block.disable) {
							core.battle(block.event.id, tx, ty);
							core.updateCheckBlock();
						} else {
							return;
						}
					} else if (type === 'item') {
						const item = core.material.items[block.event.id];
						if (canGetItem(item, loc, floorId)) {
							core.getItem(item.id, 1, tx, ty);
							if (!core.isReplaying() && Transition) {
								let px = tx * 32 - core.bigmap.offsetX;
								let py = ty * 32 - core.bigmap.offsetY;
								const t = new Transition();
								const onDestory = function (t) {
									t.ticker.destroy();
									const index = transitionList.findIndex(v => v === t);
									transitionList.splice(index, 1);
								} // 摧毁Transition t
								core.plugin.tickerSet.add(t.ticker);
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
										onDestory(t);
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
			const block = core.getBlock(x, y);
			if (block != null && block.event.cls !== 'items') return; // 角色站的位置为空地和物品以外的图块，不清（例如箭头，可能无法返回）

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
			form.append('type', '1');
			form.append('towername', towerName);
			core.utils.http(
				'POST',
				'https://h5mota.com/backend/tower/barrage.php',
				form,
				function (res) {
					try {
						res = JSON.parse(res);
						console.log(res);
						core.drawTip('接收成功！', 'postman');
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
						core.drawFailTip('在线留言接收失败！ ' + err.message, 'postman');
					}
				},
				function (err) {
					console.log(err);
					if (['Abort', 'Timeout', 'Error on Connection'].includes(err)) err = { message: '连接异常' };
					else if (err.startsWith('HTTP ')) err = { message: '连接异常, 状态码:' + err.replace('HTTP ', '') };
					else err = JSON.parse(err);
					core.drawFailTip('在线留言接收失败! ' + err?.message, 'postman');
				},
				null, null, null, 1000
			);
		}

		this.postComment = function (comment, tags) {
			if (core.isReplaying()) return;
			const isEmpty = /^\s*$/;
			if (isEmpty.test(comment)) {
				core.drawFailTip('您输入的消息为空，请重发！', 'postman');
				return;
			}
			let form = new FormData();
			form.append('type', '2');
			form.append('towername', towerName);
			form.append('comment', comment);
			form.append('tags', tags);
			core.utils.http(
				'POST',
				'https://h5mota.com/backend/tower/barrage.php',
				form,
				function (res) {
					try {
						res = JSON.parse(res);
						console.log(res);
						if (res?.code === 0) {
							core.drawTip('提交成功！ ', 'postman')
						} else {
							core.drawTip('提交失败！ ' + res?.message, 'postman');
						}
					} catch (err) {
						core.drawFailTip('提交失败！ ' + err.message, 'postman');
					}
				},
				function (err) {
					console.log(err);
					if (['Abort', 'Timeout', 'Error on Connection'].includes(err)) err = { message: '连接异常' };
					else if (err.startsWith('HTTP ')) err = { message: '连接异常, 状态码:' + err.replace('HTTP ', '') };
					else err = JSON.parse(err);
					core.drawFailTip('提交失败！ ' + err?.message, 'postman');
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
						const [x, y] = pos.split(',').map(x => Number(x));
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
			const ani = new Animation();
			core.plugin.tickerSet.add(ani.ticker);
			ani.ticker.add(() => {
				core.fillText(ctxName, content, x + ani.x, y, 'white', '16px Verdana');
			})
			// 弹幕的最大长度5600，再长属于异常数据
			const aim = 100 + Math.min(core.calWidth(ctxName, content, '16px Verdana'), 5000);
			ani.mode(linear())
				.time(aim / vx)
				.absolute()
				.move(-aim, 0)
			ani.all().then(() => {
				ani.ticker.destroy();
			});
		}
		//#endregion 

	},
	"uiBaseClass": function () {
		// 本插件定义了一些用于绘制的基类

		/** 按钮基类 */
		class ButtonBase {
			constructor(x, y, w, h) {
				this.x = x;
				this.y = y;
				this.w = w;
				this.h = h;
				this.disable = false;
				this.status = 'none';

				// 下面三项在initBtnList时添加
				/** @type {MenuBase} 所在的Menu，用于触发重绘等事件 */
				this.menu;
				/** @type {string} 所在的Menu的画布名称 */
				this.ctx = '';
				/** @type {string} 自身在所在的Menu的btnList中的索引 */
				this.key = '';

				this.draw = () => { };
				this.event = (x, y, px, py) => { };
			}

			/** 默认为矩形判定区 */
			inRange(px, py) {
				return px >= this.x && px <= this.x + this.w && py >= this.y && py <= this.y + this.h;
			}
		}

		class RoundBtn extends ButtonBase {
			constructor(x, y, w, h, text, config) {
				super(x, y, w, h);
				this.text = text;
				this.config = config || {};
				this.draw = () => {
					const ctx = this.ctx;
					const { fillStyle = 'rgb(204, 204, 204)', strokeStyle = 'black', fontStyle = 'black',
						selectedFillStyle = 'rgb(255, 51, 153)', selectedstrokeStyle = 'black', selectedFontStyle = 'white',
						radius = 3, lineWidth = 1, angle = null, font = '16px Verdana' } = this.config || {};
					core.setTextAlign(ctx, 'center');
					core.setTextBaseline(ctx, 'alphabetic');
					if (this.status === 'selected') {
						core.fillRoundRect(ctx, x, y, w, h, radius, selectedFillStyle, angle);
						core.strokeRoundRect(ctx, x, y, w, h, radius, selectedstrokeStyle, lineWidth, angle);
						core.fillText(ctx, this.text, x + w / 2, y + h / 2 + 5, selectedFontStyle, font);
					} else {
						core.fillRoundRect(ctx, x, y, w, h, radius, fillStyle, angle);
						core.strokeRoundRect(ctx, x, y, w, h, radius, strokeStyle, lineWidth, angle);
						core.fillText(ctx, this.text, x + w / 2, y + h / 2 + 5, fontStyle, font);
					}
				};
			}
		}

		class IconBtn extends ButtonBase {
			constructor(x, y, w, h, icon, config) {
				super(x, y, w, h);
				this.icon = icon;
				this.config = config || {};
				this.draw = () => {
					const ctx = this.ctx;
					const { strokeStyle = 'black', fillStyle = 'white',
						radius = 3, lineWidth = 1, angle = null, frame = 0,
					} = this.config || {};
					if (fillStyle !== 'none') core.fillRoundRect(ctx, this.x, this.y, this.w, this.h, radius, fillStyle, angle);
					if (strokeStyle !== 'none') core.strokeRoundRect(ctx, this.x, this.y, this.w, this.h, radius, strokeStyle, lineWidth, angle);
					core.drawIcon(ctx, this.icon, this.x, this.y, this.w, this.h, frame);
				};
			}
		}

		class ExitBtn extends ButtonBase {
			constructor(x, y, w, h, config) {
				super(x, y, w, h);
				this.config = config || {};
				this.draw = () => {
					const ctx = this.ctx;
					const { strokeStyle = ' #D32F2F', fillStyle = ' #EF5350', lineStyle = 'white',
						radius = 3, lineOffsetX = 5, lineWidthX = 3,
					} = this.config || {};
					const [x, y, w, h] = [this.x, this.y, this.w, this.h];
					core.fillRoundRect(ctx, x, y, w, h, radius, fillStyle);
					core.strokeRoundRect(ctx, x, y, w, h, radius, strokeStyle);
					core.drawLine(ctx, x + lineOffsetX, y + lineOffsetX, x + w - lineOffsetX, y + h - lineOffsetX, lineStyle, lineWidthX);
					core.drawLine(ctx, x + lineOffsetX, y + h - lineOffsetX, x + w - lineOffsetX, y + lineOffsetX, lineStyle, lineWidthX);
				}
			}
		}

		class MenuBase {
			constructor(name, x, y, w, h, zIndex) {
				this.name = name;
				/** @type {Map<any, ButtonBase>} 本菜单上的按钮列表，每次绘制将触发按钮的draw事件 */
				this.btnList = new Map();
				/** 当前画布是否正被绘制 */
				this.onDraw = false;

				this.x = x ?? 0;
				this.y = y ?? 0;
				this.w = w ?? core.__PIXELS__;
				this.h = h ?? core.__PIXELS__;
				this.zIndex = zIndex ?? 136; // 136比uievent大1

				/** 屏幕被按下时触发的事件 */
				this.clickEvent = (x, y, rawpx, rawpy) => {
					if (!this.isPosValid(rawpx, rawpy)) return;
					const [px, py] = this.convertCoordinate(rawpx, rawpy);
					this.btnList.forEach((btn) => {
						if (btn.disable) return;
						if (btn.inRange(px, py)) {
							btn.event(x, y, px, py);
						}
					});
				}
				/** @type {((keycode:number)=>void) | undefined} 按键被按下时触发的事件 */
				this.keyEvent = undefined;
				/** @type {((keycode:number,altkey?:boolean,fromReplay?:boolean)=>void) | undefined} 按键被放开时触发的事件 */
				this.keyUpEvent = undefined;
				/** @type {((x:number,y:number,px:number,py:number)=>void) | undefined} 屏幕被鼠标滑动或手指拖动时触发的事件 */
				this.onMoveEvent = undefined;
				/** @type {((x:number,y:number,px:number,py:number)=>void) | undefined} 当屏幕被鼠标或手指放开时触发的事件 */
				this.onUpEvent = undefined;
				/** @type {((direct:1|-1)=>void) | undefined} 鼠标滚轮滚动时触发的事件 */
				this.onMouseWheelEvent = undefined;
			}

			/** @param {[any, ButtonBase][]} arr */
			initBtnList(arr) {
				this.btnList = new Map(arr);
				this.btnList.forEach((button, key) => {
					button.menu = this;
					button.ctx = this.name;
					button.key = key;
				})
			}

			// 返回换算后的画布上的相对坐标
			convertCoordinate(px, py) {
				return [px - this.x, py - this.y];
			}

			// 检查坐标是否在画布范围内
			isPosValid(px, py) {
				return (px >= this.x) && (px <= this.x + this.w) && (py >= this.y) && (py <= this.y + this.h);
			}

			// 创建并返回本菜单的画布
			createCanvas() {
				return core.createCanvas(this.name, this.x, this.y, this.w, this.h, this.zIndex);
			}

			drawButtonContent() {
				this.btnList.forEach((button) => {
					if (!button.disable) button.draw();
				})
			}

			drawContent() {
				this.drawButtonContent();
				this.onDraw = true;
			}

			beginListen() {
				core.registerAction('ondown', this.name, this.clickEvent, 100);
				if (this.keyEvent) core.registerAction('keyDown', this.name, this.keyEvent, 100);
				if (this.keyUpEvent) core.registerAction('keyUp', this.name, this.keyUpEvent, 100);
				if (core.platform.isPC && this.onMoveEvent) core.registerAction('onmove', this.name, this.onMoveEvent, 100);
				if (this.onUpEvent) core.registerAction('onup', this.name, this.onUpEvent, 100);
				if (core.platform.isPC && this.onMouseWheelEvent) core.registerAction('onmousewheel', this.name, this.onMouseWheelEvent, 100);
			}

			endListen() {
				core.unregisterAction('ondown', this.name);
				core.unregisterAction('keyDown', this.name);
				core.unregisterAction('keyUp', this.name);
				core.unregisterAction('onmove', this.name);
				core.unregisterAction('onup', this.name);
				core.unregisterAction('onmousewheel', this.name);
			}

			clear() {
				this.endListen();
				core.deleteCanvas(this.name);
				this.onDraw = false;
			}

			init() {
				this.beginListen();
				this.drawContent();
			}
		}
		this.uiBase = { ButtonBase, RoundBtn, IconBtn, ExitBtn, MenuBase };
	},
	"newBackpackLook": function () {
		let __enable = true;
		if (!__enable) return;

		// #region 复写

		core.ui._drawToolbox = function () { drawItemBox('all'); }.bind(core.ui);
		core.ui._drawEquipbox = function () { drawItemBox('equips'); }.bind(core.ui);
		core.actions._keyDownToolbox = core.actions._keyDownEquipbox = function (keyCode) { return true; }.bind(core.actions);
		core.actions._clickToolbox = core.actions._clickEquipbox = function (x, y, px, py) { return true; }.bind(core.actions);
		core.actions._keyUpToolbox = core.actions._keyUpEquipbox = function (keyCode) { return true; }.bind(core.actions);

		const oriClosePanel = core.ui.closePanel;
		core.ui.closePanel = function () {
			oriClosePanel.apply(core.ui, [arguments]);
			clearAll();
		}

		core.control._replayAction_item = function (action) {
			if (action.indexOf("item:") != 0) return false;
			const itemId = action.substring(5);
			if (!core.canUseItem(itemId)) return false;
			if (core.material.items[itemId].hideInReplay || core.status.replay.speed == 24) {
				core.useItem(itemId, false, core.replay);
				return true;
			};
			core.ui._drawToolbox(0);
			const itemInv = globalUI.itemInv;
			const totalIndex = itemInv.allItemList.indexOf(itemId);
			const page = Math.max(Math.ceil(totalIndex / itemInv.pageCap) - 1, 0);
			const currIndex = totalIndex - page * itemInv.pageCap;
			itemInv.page = page;
			itemInv.focus(currIndex);
			redraw();
			setTimeout(function () {
				core.ui.closePanel();
				core.useItem(itemId, false, core.replay);
			}, core.control.__replay_getTimeout());
			return true;
		}

		core.control._replayAction_equip = function (action) {
			if (action.indexOf("equip:") != 0) return false;
			const equipId = action.substring(6);
			if (!core.hasItem(equipId)) {
				core.removeFlag('__doNotCheckAutoEvents__');
				return false;
			}

			const callbackFunc = function () {
				const next = core.status.replay.toReplay[0] || "";
				if (!next.startsWith('equip:') && !next.startsWith('unEquip:')) {
					core.removeFlag('__doNotCheckAutoEvents__');
					core.checkAutoEvents();
				}
				core.replay();
			}
			core.setFlag('__doNotCheckAutoEvents__', true);

			core.status.route.push(action);
			if (core.material.items[equipId].hideInReplay || core.status.replay.speed == 24) {
				core.loadEquip(equipId, callbackFunc);
				return true;
			}
			core.ui._drawEquipbox(0);
			const { itemId, itemInv } = globalUI;
			const totalIndex = itemInv.allItemList.indexOf(itemId);
			const page = Math.max(Math.ceil(totalIndex / itemInv.pageCap) - 1, 0);
			const currIndex = totalIndex - page * itemInv.pageCap;
			itemInv.page = page;
			itemInv.focus(currIndex);
			redraw();
			setTimeout(function () {
				core.ui.closePanel();
				core.loadEquip(equipId, callbackFunc);
			}, core.control.__replay_getTimeout());
			return true;
		}

		core.control._replayAction_unEquip = function (action) {
			if (action.indexOf("unEquip:") != 0) return false;
			const equipType = parseInt(action.substring(8));
			if (!core.isset(equipType)) {
				core.removeFlag('__doNotCheckAutoEvents__');
				return false;
			}

			const callback = function () {
				redraw();
				core.ui.closePanel();
				const next = core.status.replay.toReplay[0] || "";
				if (!next.startsWith('equip:') && !next.startsWith('unEquip:')) {
					core.removeFlag('__doNotCheckAutoEvents__');
					core.checkAutoEvents();
				}
				core.replay();
			}
			core.setFlag('__doNotCheckAutoEvents__', true);

			core.status.route.push(action);
			if (core.status.replay.speed == 24) {
				core.unloadEquip(equipType, callback);
				return true;
			}
			const itemInv = globalUI.itemInv;
			const page = Math.max(Math.ceil(equipType / itemInv.pageCap) - 1, 0);
			const currIndex = equipType - page * itemInv.pageCap;
			itemInv.page = page;
			itemInv.focus(currIndex);
			core.ui._drawEquipbox(0);
			setTimeout(function () {
				core.unloadEquip(equipType, callback);
			}, core.control.__replay_getTimeout());
			return true;
		}
		core.registerReplayAction("item", core.control._replayAction_item);
		core.registerReplayAction("equip", core.control._replayAction_equip);
		core.registerReplayAction("unEquip", core.control._replayAction_unEquip);

		// 复写control.startReplay
		const oriStartReplay = core.control.startReplay; // 进入播放录像模式时清空道具栏选中目标的缓存
		core.control.startReplay = function (list) {
			clearItemBoxCache();
			oriStartReplay.apply(core.control, [list, ...arguments]);
		}

		// 复写items._afterUseItem
		// flag:itemsUsedCount {[itemId:string]:boolean} 成功使用了的道具的计数
		const origin__afterUseItem = items.prototype._afterUseItem;
		items.prototype._afterUseItem = function (itemId) {
			const itemsUsedCount = core.getFlag('itemsUsedCount', {});
			if (!itemsUsedCount.hasOwnProperty(itemId)) itemsUsedCount[itemId] = 0;
			itemsUsedCount[itemId]++;
			core.setFlag('itemsUsedCount', itemsUsedCount);
			origin__afterUseItem(itemId);
		}

		// 复写ui.getToolboxItems
		// flag:markedItems string[] 在道具栏中置顶的道具的列表
		// flag:hideInfo {[itemId:string]:boolean} 手动选择了显示/隐藏的道具的列表
		core.ui.getToolboxItems = function (cls, showHide, sortFunc) {
			const markedItems = core.getFlag('markedItems', []);

			// 暂时不采用按使用次数排序这个函数 因为导致物品排序频繁变动，反而体验不好
			// const itemsUsedCount = core.getFlag('itemsUsedCount', {});
			// if (!sortFunc) sortFunc = (itemId1, itemId2) => {
			// 	const item1Count = itemsUsedCount[itemId1] || 0,
			// 		item2Count = itemsUsedCount[itemId2] || 0;
			// 	return item2Count - item1Count;
			// }

			let list = [];
			if (cls === 'all') {
				for (let name in core.status.hero.items) {
					if (name === "equips") continue;
					list = list.concat(Object.keys(core.status.hero.items[name])); // 获取'constants'和'tools'整体的列表
				}
			}
			else if (core.status.hero.items[cls]) {
				list = Object.keys(core.status.hero.items[cls] || {});
			}
			const markedList = list.filter((itemId) => markedItems.includes(itemId)).sort(sortFunc),
				unmarkedList = list.filter((itemId) => !markedItems.includes(itemId)).sort(sortFunc);
			list = [...markedList, ...unmarkedList];
			const hideInfo = core.getFlag('hideInfo', {});
			if (!showHide) list = list.filter(function (id) {
				if (hideInfo[id]) return false;
				return !core.material.items[id].hideInToolbox;
			})
			return list;
		}

		// 复写resize，保证屏幕变化时此画布表现正常
		const originResize = core.control.resize;
		core.control.resize = function () {
			originResize.apply(core.control, arguments);
			const { _back, _itemInv, _equipChangeBoard, _itemInfoBoard } = globalUI;
			[_back, _itemInv, _equipChangeBoard, _itemInfoBoard].forEach((menu) => { if (menu && menu.onDraw) menu.drawContent(); });
		}

		// #endregion
		const { ButtonBase, RoundBtn, IconBtn, ExitBtn, MenuBase } = core.plugin.uiBase;
		// #region 绘制用到的按钮类

		class HideBtn extends RoundBtn {
			constructor(x, y, w, h, config) {
				super(x, y, w, h, '隐藏', config);
				const oriDraw = this.draw;
				this.draw = () => {
					const itemId = globalUI.itemId;
					if (core.material.items[itemId]) {
						const hideInfo = core.getFlag('hideInfo', {});
						if (hideInfo.hasOwnProperty(itemId)) this.text = hideInfo[itemId] ? "显示" : "隐藏";
						else this.text = core.material.items[itemId].hideInToolbox ? "显示" : "隐藏";
					}
					oriDraw();
				}
			}
		}

		class MarkBtn extends RoundBtn {
			constructor(x, y, w, h, config) {
				super(x, y, w, h, '隐藏', config);
				const oriDraw = this.draw;
				this.draw = () => {
					const itemId = globalUI.itemId;
					const markedItems = core.getFlag('markedItems', []);
					this.text = markedItems.includes(itemId) ? "取消" : "置顶";
					oriDraw();
				}
			}
		}

		class ClassifyBtn extends RoundBtn {
			constructor(x, y, w, h, text, subType, config) {
				super(x, y, w, h, text, config);
				this.subType = subType;
				const oriDraw = this.draw;
				this.draw = () => {
					const { type, toolInv } = globalUI;
					if (type === 'equips') return;
					if (toolInv.subType === this.subType) this.status = 'selected';
					else this.status = "none";
					oriDraw();
				}
				this.event = () => {
					const { type, toolInv } = globalUI;
					if (type === 'equips') return;
					if (toolInv.subType !== this.subType) {
						const oldConfig = toolInv.cache[toolInv.subType],
							newConfig = toolInv.cache[this.subType];
						oldConfig.page = toolInv.page;
						oldConfig.index = toolInv.index;
						toolInv.page = newConfig.page;
						toolInv.index = newConfig.index;
						toolInv.subType = this.subType;
						toolInv.updateItemList();
						redraw(true);
					}
				};
			}
		}

		class ShowHideBtn extends ButtonBase {
			constructor(x, y, w, h) {
				super(x, y, w, h)
				this.draw = () => {
					const ctx = this.ctx;
					const squareSize = this.h;
					core.strokeRect(ctx, this.x, this.y, squareSize, squareSize, 'black');
					core.fillRect(ctx, this.x + 1, this.y + 1, squareSize - 2, squareSize - 2, 'white');
					const font = core.ui._buildFont(this.h - 4);
					core.setTextAlign(ctx, 'left');
					core.setTextBaseline(ctx, 'middle');
					if (core.hasFlag('showHideItem')) core.fillText(ctx, '√', this.x + 3, this.y + 10, 'red', font);
					core.fillText(ctx, '查看隐藏', this.x + squareSize + 6, this.y + 10, 'white', font);
				};

				this.event = () => {
					const itemInv = globalUI.itemInv;
					core.setFlag('showHideItem', !core.getFlag('showHideItem', false));
					itemInv.updateItemList();
					redraw();
				}
			}
		}

		/** 切换道具栏和装备栏的按钮 */
		class SwitchBtn extends IconBtn {
			constructor(x, y, w, h, config) {
				super(x, y, w, h, '', config);
				const oriDraw = this.draw;
				this.draw = () => {
					this.icon = (globalUI.type === 'all') ? 'toolbox' : 'equipbox';
					oriDraw();
				}
				this.event = () => {
					switchType();
					redraw(true);
				}
			}
		}

		class ArrowBtn extends ButtonBase {
			constructor(x, y, w, h, dir, config) {
				super(x, y, w, h);
				this.config = config || {};
				/** @type {'left'|'right'} */this.dir = dir;
				this.draw = () => {
					const { marginLeft = 6, marginTop = 5, marginRight = 4,
						backStyle = 'gray', arrowStyle = 'black'
					} = this.config || {};
					const ctx = this.ctx;
					core.fillRoundRect(ctx, this.x, this.y, this.w, this.h, 3, backStyle);
					if (this.dir === 'left')
						core.fillPolygon(ctx, [[this.x + this.w - marginLeft, this.y + marginTop], [this.x + this.w - marginLeft, this.y + this.h - marginTop],
						[this.x + marginRight, this.y + this.h / 2]], arrowStyle);
					else if (this.dir === 'right')
						core.fillPolygon(ctx, [[this.x + marginLeft, this.y + marginTop], [this.x + marginLeft, this.y + this.h - marginTop],
						[this.x + this.w - marginRight, this.y + this.h / 2]], arrowStyle);
					core.setAlpha(ctx, 1);
				};
			}
		}
		/** 物品背包的单个道具选框 */
		class ItemBox extends ButtonBase {
			constructor(x, y, w, h) {
				super(x, y, w, h);
				/** @type {ItemInventory} */this.menu;
				this.draw = () => {
					const menu = this.menu;
					const ctx = this.ctx;
					const itemId = menu.currItemList[this.key];
					const y = this.y;

					const item = core.material.items[itemId] || {};
					const num = core.formatBigNumber(core.itemCount(itemId), 5) || 0; // 道具数量过大时需要format

					// 被隐藏的道具在显示时需要半透明
					const hideInfo = core.getFlag('hideInfo', {});
					if (item && (hideInfo.hasOwnProperty(itemId) ? hideInfo[itemId] : item.hideInToolbox)) core.setAlpha(ctx, 0.5);

					// 绘制物品图标
					if (core.material.items[itemId]) core.drawIcon(ctx, itemId, 4, this.y + 6, 18, 18);

					core.setTextAlign(ctx, "right");
					core.setTextBaseline(ctx, "middle");
					// 绘制物品数量 ×几
					const numText = "×" + num;
					core.fillText(ctx, numText, 220, y + menu.oneItemHeight / 2, 'white', '18px Verdana');

					// 绘制物品名称
					const markedItems = core.getFlag('markedItems', []);
					const name = item.name || "???";
					core.setTextAlign(ctx, "left");
					core.fillText(ctx, name, 24, this.y + menu.oneItemHeight / 2, markedItems.includes(itemId) ? 'gold' : 'white', '18px Verdana', 180);
					core.setAlpha(ctx, 1);
				}

				this.event = () => { this.menu.triggerItem(); };
			}
		}
		/** 切换装备面板的单个装备选框 */
		class EquipBox extends ButtonBase {
			constructor(x, y, w, h) {
				super(x, y, w, h);
				/** @type {EquipChangeBoard} */this.menu;
				this.draw = () => {
					const ctx = this.ctx;
					const [x, y, w, h] = [this.x, this.y, this.w, this.h];
					const space = 2, lineWidth = 2, squareSize = w;
					const equipId = core.getEquip(this.key);
					if (equipId) core.drawIcon(ctx, equipId, x + 4, y + 4, squareSize - 8, squareSize - 8);
					const color = (globalUI.selectType === 'equipBox' && this.menu.index === this.key) ? 'gold' : 'white';
					core.strokeRect(ctx, x, y, squareSize, squareSize, color, lineWidth);
					core.setTextAlign(ctx, "center");
					core.setTextBaseline(ctx, "top");
					const tx = x + w / 2,
						ty = y + squareSize + space;
					core.fillText(ctx, this.menu.currItemList[this.key], tx, ty, color, '14px Verdana');
				};
				this.event = () => {
					this.menu.triggerItem();
				};
			}
		}

		// #endregion
		// #region 绘制用到的菜单类

		// 道具栏/装备栏的背景
		class ItemBoxBack extends MenuBase {
			constructor() {
				super('itemBoxBack'); // 装备栏和道具栏共用同一个光标，故所有按键事件全部写在这里处理
				this.keyEvent = (keyCode) => {
					const { type, selectType, itemInv, equipChangeBoard } = globalUI;
					if (keyCode === 37) { // left	
						if (selectType === 'toolBox') itemInv.pageDown();
						else if (selectType === 'equipBox') {
							if (equipChangeBoard.index === 0) {
								equipChangeBoard.pageDown();
							}
							else equipChangeBoard.focus(equipChangeBoard.index - 1);
						}
					}
					else if (keyCode === 39) { // right		
						if (selectType === 'toolBox') itemInv.pageUp();
						else if (selectType === 'equipBox') {
							if (equipChangeBoard.index === equipChangeBoard.currItemList.length - 1) {
								equipChangeBoard.pageUp();
							}
							else equipChangeBoard.focus(equipChangeBoard.index + 1);
						}
					}
					else if (keyCode === 38) { // up
						if (selectType === 'toolBox') {
							if (itemInv.index === 0) {
								if (type === 'equips') { // 在仅物品栏模式下点上键到顶，切换到上一页，否则会切换到装备栏
									equipChangeBoard.focus(equipChangeBoard.currItemList.length - 1);
								}
								else {
									itemInv.pageDown(); // 向上到顶将翻到上一页
								}
							}
							else {
								itemInv.focus(itemInv.index - 1);
								redraw();
							}
						}
						else if (selectType === 'equipBox') {
							if (equipChangeBoard.index >= equipChangeBoard.rowMax) {
								equipChangeBoard.index -= equipChangeBoard.rowMax;
								redraw();
							}
						}
					}
					else if (keyCode === 40) { // down
						if (selectType === 'toolBox') {
							if (itemInv.index < itemInv.currItemList.length - 1) {
								itemInv.focus(itemInv.index + 1);
							}
							else {
								itemInv.pageUp(); // 向下到底将翻到下一页
							}
						}
						else if (selectType === 'equipBox') {
							let newIndex = equipChangeBoard.index + equipChangeBoard.rowMax;
							if (newIndex < equipChangeBoard.currItemList.length - 1) {
								equipChangeBoard.focus(newIndex);
							}
							else {
								equipChangeBoard.focus(0);
							}
						}
					}
				};
				this.keyUpEvent = (keyCode, altKey) => {
					const { itemId, selectType, itemInv, equipChangeBoard } = globalUI;
					if (keyCode === 81) { // Q
						if (globalUI.type === "equips") exit();
						else switchType();
					}
					else if (keyCode === 84) { // T
						if (globalUI.type === "all") exit();
						else switchType();
					}
					else if (keyCode === 8 || keyCode === 27) { // BackSpace/Esc
						exit();
					}
					else if (keyCode === 13 || keyCode === 32 || keyCode === 67) { // Enter/SpaceBar/C
						if (selectType === "toolBox") {
							if (core.material.items[itemId]) itemInv.triggerItem();
						}
						else if (selectType === "equipBox") {
							equipChangeBoard.triggerItem();
							redraw();
						}
						else {
							itemInv.focus(0);
						}
					}
					else if (altKey && keyCode >= 48 && keyCode <= 57) { // 都有自动切装了还有神人想要这个Alt换装 服了
						core.items.quickSaveEquip(keyCode - 48);
						return;
					}
				}
			}

			drawContent() {
				const ctx = this.createCanvas();
				this.drawBackGround(ctx);
				super.drawContent();
			}

			drawBackGround(ctx) {
				core.strokeRoundRect(ctx, 2, 2, 412, 412, 5, 'white', 2);
				core.fillRoundRect(ctx, 3, 3, 410, 410, 5, 'rgb(108, 187, 219)');
				core.drawLine(ctx, 248, 3, 248, 413, 'white', 2); // 左栏和右栏的分界线
				if (globalUI.type === 'equips') core.drawLine(ctx, 3, 140, 248, 140, 'white', 2); // 装备栏和道具栏的分界线
			}
		}

		// selectType采用一套新的逻辑来判定 

		// 物品列表和换装界面的共用基类 
		class ItemBoxBase extends MenuBase {
			constructor(name, x, y, w, h, zIndex) {
				super(name, x, y, w, h, zIndex);
				/** 当前页 */
				this.page = 0;
				/** 一页最多可容纳的道具数量 */
				this.pageCap = 0;
				/** 当前最大页数，page应小于此值*/
				this.pageMax = 1;
				/** @type {string[]} 此界面总的物品列表 */
				this.allItemList = [];
				/** @type {string[]} 此界面当前页展示的物品列表 */
				this.currItemList = [];
				/** 当前选中了第几个道具 */
				this.index = 0;
				/** 当前选中的道具的名称 */
				this.itemId = '';

				this.clickEvent = (x, y, rawpx, rawpy) => {
					if (!this.isPosValid(rawpx, rawpy)) return;
					const [px, py] = this.convertCoordinate(rawpx, rawpy);
					this.btnList.forEach((btn) => {
						if (btn.disable) return;
						if (btn.inRange(px, py)) {
							if (btn instanceof ItemBox || btn instanceof EquipBox) {
								if (btn.key !== this.index) this.focus(btn.key);
								else btn.event();
							}
							else if (btn instanceof ArrowBtn) btn.event(x, y, px, py);
						}
					});
				}
				this.onMoveEvent = (x, y, rawpx, rawpy) => {
					if (!this.isPosValid(rawpx, rawpy)) return;
					const [px, py] = this.convertCoordinate(rawpx, rawpy);
					this.btnList.forEach((btn) => {
						if (btn.disable) return;
						if (btn.inRange(px, py)) {
							if (btn instanceof ItemBox || btn instanceof EquipBox) {
								if (btn.key !== this.index ||
									(this instanceof EquipChangeBoard && globalUI.type !== 'equips') ||
									(this instanceof ItemBoxBase && globalUI.type !== 'all')) this.focus(btn.key);
							}
						}
					});
				}
			}

			/** 
			 * @abstract 获取最新的物品列表
			 * @returns {string[]}
			 */
			getItemList() { return []; }

			/** @abstract 尝试使用当前选中的物品 */
			triggerItem() { }

			/** 更新物品列表 */
			updateItemList() {
				this.allItemList = this.getItemList();
				this.pageMax = Math.ceil(this.allItemList.length / this.pageCap);
				if (this.pageMax < 1) this.pageMax = 1;
				this.currItemList = this.allItemList.slice(this.page * this.pageCap, (this.page + 1) * this.pageCap);
				if (this.index >= this.currItemList.length) this.index = 0;
				this.itemId = this.currItemList[this.index];
			}

			/** 聚焦于指定序号的按钮，并重绘画面 */
			focus(index) {
				this.index = index;
				this.itemId = this.currItemList[this.index];
				this.btnList.forEach(btn => {
					btn.status = (btn.key === this.index) ? 'selected' : 'none'
				});
				globalUI.selectType = (this instanceof EquipChangeBoard) ? 'equipBox' : 'toolBox';
				globalUI.itemId = this.itemId;
				redraw();
			}

			canPageUp() {
				return this.page < this.pageMax - 1;
			}

			canPageDown() {
				return this.page > 0;
			}

			pageUp() {
				if (!this.canPageUp()) return;
				this.page++;
				this.updateItemList();
				this.focus((this.index < this.currItemList.length) ? this.index : 0);
			}

			pageDown() {
				if (!this.canPageDown()) return;
				this.page--;
				this.updateItemList();
				this.focus(this.index);
			}
		}

		/** 展示角色当前已穿戴的装备的面板 */
		class EquipChangeBoard extends ItemBoxBase {
			constructor(x, y, w, h, zIndex) {
				super('equipChangeBoard', x, y, w, h, zIndex);
				this.columnMax = 4;
				this.rowMax = 2;
				this.pageCap = this.columnMax * this.rowMax;
				this.updateItemList();
			}

			drawContent() {
				const ctx = this.createCanvas();
				if (this.pageMax > 1) {
					core.setTextAlign(ctx, "center");
					core.setTextBaseline(ctx, "alphabetic");
					core.fillText(ctx, this.page + 1 + '/' + this.pageMax, this.w / 2, this.h - 2, 'white', '12px Verdana');
				}

				const currNameList = this.currItemList;
				const columnCount = Math.min(currNameList.length, this.columnMax),  // 判断装备孔数量是否小于最大列数
					rowCount = Math.min(Math.ceil(currNameList.length / this.columnMax), this.rowMax);
				const [boxWidth, boxHeight] = [36, 52];
				const spaceX = (this.w - columnCount * boxWidth) / (1 + columnCount),
					spaceY = (this.h - rowCount * boxHeight) / (1 + rowCount);
				let [x, y] = [spaceX, spaceY];
				/** @type {[number, EquipBox][]} */
				const btnArr = [];

				for (let i = 0; i < this.currItemList.length; i++) {
					const btn = new EquipBox(x, y, boxWidth, boxHeight);
					btnArr.push([i, btn]);
					if ((i + 1) % this.columnMax === 0) {
						x = spaceX;
						y += spaceY + boxHeight;
					}
					else x += spaceX + boxWidth;
				}
				this.initBtnList(btnArr);
				super.drawContent();
			}
			/**  注意，对于装备切换面板来说，它的装备列表不是装备本身，而是角色的装备孔 */
			getItemList() {
				return core.status.globalAttribute.equipName;
			}

			triggerItem() {
				const index = this.index;
				if (core.status.hero.equipment[index]) {
					core.unloadEquip(index);
					core.status.route.push("unEquip:" + index);
					this.updateItemList();
					globalUI.itemInv.updateItemList(); //穿脱装备是双向的过程，装备栏和道具栏的物品列表组成都会变
					redraw();
				}
			}
		}

		/** 展示角色当前背包物品的面板，有道具/装备两种模式 */
		class ItemInventory extends ItemBoxBase {
			constructor(name, x, y, w, h, zIndex) {
				super(name, x, y, w, h, zIndex);

				/** @type {number} 单个物品占据的列宽 */
				this.oneItemHeight = 30;
				/** @type {number} 单个页面显示的物品数, -1是因为最后一行要留给换行按钮*/
				this.pageCap = Math.floor(h / this.oneItemHeight) - 1;
			}

			drawContent() {
				const ctx = this.createCanvas();
				const [x, y, w, h] = [this.x, this.y, this.w, this.h];
				core.fillRect(ctx, 0, 0, w, h, 'rgb(0, 105, 148)');

				core.setTextBaseline(ctx, "middle");
				for (let i = 0; i < this.pageCap; i++) {
					const btn = this.btnList.get(i);
					if (btn && btn instanceof ItemBox) btn.disable = i >= this.currItemList.length;
				}
				core.setTextAlign(ctx, "center");
				core.setTextBaseline(ctx, "alphabetic");
				core.fillText(ctx, (this.page + 1) + '/' + this.pageMax, w / 2, h - 4, 'white', '12px Verdana');
				if (globalUI.selectType === 'toolBox') { // 光标绘制是绝对坐标
					core.drawUIEventSelector(1, 'winskin.png', x, y + this.index * this.oneItemHeight, w, this.oneItemHeight, 140);
				} else core.clearUIEventSelector(1);
				super.drawContent();
			}

			clear() {
				core.clearUIEventSelector(1);
				super.clear();
			}
		}

		class ToolInventory extends ItemInventory {
			constructor(x, y, w, h, zIndex) {
				super('toolInventory', x, y, w, h, zIndex);
				/** @type {'all'|'tools'|'constants'} 当前显示哪个子菜单 */
				this.subType = 'all';

				/** 各个子页面当前选中的位置，用于在切换后显示原位置 */
				this.cache = {
					all: { page: 0, index: 0 },
					tools: { page: 0, index: 0 },
					constants: { page: 0, index: 0 }
				}
			}

			getItemList() {
				return core.getToolboxItems(this.subType, core.hasFlag('showHideItem'));
			}

			triggerItem() {
				const itemId = this.itemId;
				if (!core.canUseItem(itemId)) {
					core.drawFailTip("当前无法使用" + core.material.items[itemId].name, itemId);
					return;
				}
				clearAll();
				setTimeout(() => {
					core.unlockControl();
					core.tryUseItem(itemId);
				}, 0);
			}
		}

		class EquipInventory extends ItemInventory {
			constructor(x, y, w, h, zIndex) {
				super('equipInventory', x, y, w, h, zIndex);
			}

			getItemList() {
				return core.getToolboxItems('equips', core.hasFlag('showHideItem'));
			}

			triggerItem() {
				const equip = this.itemId;
				if (!core.canEquip(equip, true)) return;
				core.loadEquip(equip);
				core.status.route.push("equip:" + equip); // 注意focus会导致itemId改变
				this.updateItemList(); // 穿上装备会导致道具数量变化，并且需要重新锁定当前选中的道具
				this.focus(this.index);
			}
		}

		class ItemInfoBox extends MenuBase {
			constructor(x, y, w, h) {
				super('itemInfoBox', x, y, w, h, 137);
			}

			drawContent() {
				const ctx = this.createCanvas();
				core.strokeRoundRect(ctx, 23, 27, 32, 32, 2, 'white', 2);
				const itemId = globalUI.itemId;
				if (itemId) core.drawIcon(ctx, itemId, 24, 28, 30, 30);

				// 修改这里可以编辑未选中道具时的默认值
				const defaultItem = { cls: "constants", name: "无道具", id: "-", text: "没有道具最永久" };
				const defaultEquip = { cls: "equips", name: "无装备", id: "-", text: "一无所有，又何尝不是一种装备", equip: { type: "装备" } };
				let item = core.material.items[itemId];
				if (!item) item = (globalUI.type === 'all' ? defaultItem : defaultEquip);
				core.setTextAlign(ctx, "left");
				core.setTextBaseline(ctx, "middle");
				core.fillText(ctx, item.name, 66, 46, 'black', 'bold 18px Verdana', 98); // 物品名字 e.g.护符
				core.fillText(ctx, "类型", 20, 75, 'crimson', '14px Verdana');
				core.fillText(ctx, "【" + getItemClsName(item) + "】", 50, 75, 'rgb(47, 49, 54)', '14px Verdana'); // 物品类型 e.g.【永久道具】

				core.fillText(ctx, "ID", 20, 95, 'crimson', '14px Verdana');
				core.fillText(ctx, item.id, 50, 95, 'rgb(47, 49, 54)', '14px Verdana');

				if (globalUI.type === 'all') { // 显示物品累计使用的次数，将作为排序依据
					core.fillText(ctx, "累计使用", 20, 113, 'crimson', '14px Verdana');
					const itemsUsedCount = core.getFlag('itemsUsedCount', {});
					core.fillText(ctx, itemsUsedCount[itemId] || 0, 80, 113, 'rgb(47, 49, 54)', '14px Verdana');
				}

				const itemText = core.replaceText(item.text) + ((globalUI.type === "equips") ? this.getEquipCompareInfo(item) : ""); // 物品描述信息
				core.drawTextContent(ctx, itemText, {
					left: 20, top: 125, bold: false, color: "black",
					align: "left", fontSize: 15, maxWidth: 150
				});
				const currItemHotKey = HotkeySelect.getHotkeyNum(itemId);
				// 获取快捷键设置按钮当前的图标

				const setHotkeyBtn = /** @type {IconBtnClass} */(this.btnList.get('setHotkeyBtn'));
				if (setHotkeyBtn) {
					setHotkeyBtn.disable = (globalUI.type === 'equips');
					setHotkeyBtn.icon = (currItemHotKey == null) ? 'keyboard' : ('btn' + currItemHotKey);
				}
				super.drawContent();
			}

			/*** @param {Item} item */
			getEquipCompareInfo(item) {
				let str = '';
				if (globalUI.type !== "equips") return str;

				let equipType = item.equip?.type;
				if (!equipType) return str;
				if (typeof equipType == "string") equipType = core.getEquipTypeByName(equipType);
				let compare;
				/** @todo 准备卸下装备时显示卸下的比较信息 */
				if (globalUI.selectType == "equipBox") compare = core.compareEquipment(null, item.id);
				else compare = core.compareEquipment(item.id, core.getEquip(equipType));
				// --- 变化值...
				for (const name in core.status.hero) {
					if (typeof core.status.hero[name] != 'number') continue;
					let nowValue = core.getRealStatus(name);
					let newValue = Math.floor((core.getStatus(name) + (compare.value[name] || 0)) *
						(core.getBuff(name) * 100 + (compare.percentage[name] || 0)) / 100);
					if (nowValue === newValue) continue;
					const color = newValue > nowValue ? '#00FF00' : '#FF0000';
					const [nowValueStr, newValueStr] = [nowValue, newValue].map(value => core.formatBigNumber(value));
					str += "\n" + core.getStatusLabel(name) + " " + nowValueStr + "->\r[" + color + "]" + newValueStr + "\r";
				}
				return str;
			}
		}

		// 为当前道具设定一个快捷键
		class HotkeySelect extends MenuBase {
			constructor(itemId, x, y, w, h, zIndex) {
				super('hotkeySelect', x, y, w, h, zIndex);
				this.itemId = itemId;
				/** @type {number | null} null代表当前道具没有快捷键 */
				this.hotkeyNum = HotkeySelect.getHotkeyNum(this.itemId);
			}

			drawContent() {
				const ctx = this.createCanvas();
				const [x, y, w, h] = [this.x, this.y, this.w, this.h];
				core.fillRect(ctx, 3, 3, w - 6, h - 6, ' #A8CABA');
				core.strokeRect(ctx, 0, 0, w, h, ' #004B23', 3);
				core.setTextAlign(ctx, 'center');
				core.setTextBaseline(ctx, 'alphabetic');
				core.fillText(ctx, '为当前道具选择一个快捷键', this.w / 2, 40, 'black', '20px Verdana');
				core.fillText(ctx, '无自定义设置时样板的默认快捷键', this.w / 2, 60, 'gray', '16px Verdana');
				core.fillText(ctx, '(如123分别对应破炸飞)不可在此设置', this.w / 2, 80, 'gray', '16px Verdana');
				// 无自定义设置时样板的默认快捷键（如123分别对应破炸飞），不可在此设置
				// 绘制指向当前快捷键的监听
				if (this.hotkeyNum != null) {
					const btn = this.btnList.get('btn' + this.hotkeyNum);
					if (btn) {
						core.fillPolygon(ctx, [[btn.x + 12, btn.y + btn.h + 10], [btn.x + btn.w - 12, btn.y + btn.h + 10],
						[btn.x + btn.w / 2, btn.y + btn.h + 2]], 'black');
					}
				}
				super.drawContent();
			}
			/* @__PURE__ */
			static getHotkeyNum(itemId) {
				for (let i = 1; i <= 9; i++) {
					const currHotkey = core.getLocalStorage('hotkey' + i, null);
					if (currHotkey === itemId) {
						return i;
					}
				}
				return null;
			}

			deleteHotkey() {
				if (this.hotkeyNum != null) core.setLocalStorage('hotkey' + this.hotkeyNum, null);
			}

			setHotkey(num) {
				this.deleteHotkey();
				core.setLocalStorage('hotkey' + num, this.itemId);
				this.hotkeyNum = Number(num);
			}

			clear() {
				super.clear();
				const { back, itemInv, equipChangeBoard, itemInfoBoard } = globalUI;
				[back, itemInv, equipChangeBoard, itemInfoBoard].forEach((menu) => { menu.beginListen(); });
			}
		}
		/** @param {string} itemId */
		function hotkeySelectFactory(itemId) {
			const hotkeySelect = new HotkeySelect(itemId, 60, 100, 296, 206, 141); // 应当比物品背包的选择光标大，遮盖住前者
			/** @type {[string, ButtonBaseClass][]} */
			const btnList = [];
			const setHotkeyNum = function () {
				const num = this.key.replace('btn', '');
				hotkeySelect.setHotkey(num);
				hotkeySelect.clear();
				globalUI.itemInfoBoard.drawContent();
			}

			const [btnSize, btnInterval] = [32, 20];
			const leftMargin = hotkeySelect.w / 2 - 2.5 * btnSize - 2 * btnInterval;
			const style = { strokeStyle: 'none', fillStyle: 'none' };

			for (let i = 0; i < 9; i++) {
				const num = i + 1;
				const row = (i <= 4) ? 1 : 2;
				let btn;
				if (row === 1) btn = new IconBtn(leftMargin + i * (btnSize + btnInterval), 100, btnSize, btnSize, 'btn' + num, style);
				else btn = new IconBtn(leftMargin + (i - 5) * (btnSize + btnInterval), 150, btnSize, btnSize, 'btn' + num, style);
				btnList.push(['btn' + num, btn]);
				btn.event = setHotkeyNum.bind(btn);
			}
			const setNullBtn = new ButtonBase(leftMargin + 4 * (btnSize + btnInterval), 150, btnSize, btnSize);
			setNullBtn.draw = function () {
				const [x, y, w, h] = [this.x, this.y, this.w, this.h];
				core.strokeRect(this.ctx, x, y, w, h, 'red', 2);
				core.drawLine(this.ctx, x, y, x + w, y + h, 'red', 2);
			}.bind(setNullBtn);
			setNullBtn.event = function () {
				hotkeySelect.deleteHotkey();
				hotkeySelect.clear();
				globalUI.itemInfoBoard.drawContent();
			}
			const exitBtn = new ExitBtn(274, 5, 16, 16, { radius: 1, lineOffsetX: 2, lineWidthX: 2 });
			exitBtn.event = () => {
				hotkeySelect.clear();
			}
			btnList.push(['setNullBtn', setNullBtn], ['exitBtn', exitBtn]);
			hotkeySelect.initBtnList(btnList);
			return hotkeySelect;
		}

		// #endregion
		// #region 核心功能函数和全局变量
		function getItemClsName(item) {
			const itemClsName = {
				"constants": "永久道具",
				"tools": "消耗道具",
			}
			if (item == null) return "未知";
			if (item.cls == "equips") {
				if (typeof item.equip.type == "string") return item.equip.type;
				const type = core.getEquipTypeById(item.id);
				return core.status.globalAttribute.equipName[type];
			} else return itemClsName[item.cls] || item.cls;
		}
		/** 隐藏 | 取消隐藏当前选中的物品 */
		function hideItem(itemId) {
			if (!itemId) return;
			let hideInfo = core.getFlag('hideInfo', {});
			if (hideInfo.hasOwnProperty(itemId)) {
				hideInfo[itemId] = !hideInfo[itemId];
			} else {
				hideInfo[itemId] = !core.material.items[itemId].hideInToolbox;
			}
			core.setFlag('hideInfo', hideInfo);
		}
		/** 置顶 | 取消置顶当前选中的物品 */
		function markItem(itemId) {
			let markedItems = core.getFlag('markedItems', []);
			if (markedItems.includes(itemId)) markedItems = markedItems.filter((currId) => currId !== itemId);
			else markedItems.push(itemId);
			core.setFlag('markedItems', markedItems);
		}

		/** 初始化物品栏的所有菜单 */
		function initAll() {
			[globalUI.back, globalUI.itemInv, globalUI.itemInfoBoard].forEach((menu) => menu.init());
			if (globalUI.type === 'equips') globalUI.equipChangeBoard.init();
		}
		/** 彻底退出物品栏 */
		function clearAll() {
			[globalUI._back, globalUI._toolInv, globalUI._equipInv, globalUI._itemInfoBoard, globalUI._equipChangeBoard].forEach((menu) => {
				if (menu) menu.clear();
			});
			core.status.event.id = null;
		}

		function exit() {
			clearAll();
			setTimeout(core.unlockControl, 0);
		}

		function clearItemBoxCache() {
			globalUI.itemId = '';
			[globalUI._toolInv, globalUI._equipInv, globalUI._equipChangeBoard].forEach((menu) => {
				if (menu) menu.index = 0;
			});
		} // 每次存读档，及进行录像回放时调用，清空之前选中的道具信息
		this.clearItemBoxCache = clearItemBoxCache;

		function redraw(all) {
			globalUI.itemInv.drawContent();
			globalUI.itemInfoBoard.drawContent();
			if (globalUI.type === 'equips') globalUI.equipChangeBoard.drawContent();
			if (all) globalUI.back.drawContent();
		}

		function switchType() {
			globalUI.type = (globalUI.type === 'all') ? 'equips' : 'all';
			if (globalUI.type === 'all') {
				globalUI.equipChangeBoard.clear();
				globalUI.equipInv.clear();
			}
			else if (globalUI.type === 'equips') {
				globalUI.equipChangeBoard.init();
				globalUI.toolInv.clear();
			}
			globalUI.itemInv.beginListen(); // 接下来再进行包括此在内全体菜单的重绘
			globalUI.itemInv.updateItemList();
			globalUI.itemInv.focus(globalUI.itemInv.index);
		}

		// 以下是本插件范围内的全局变量

		const globalUI = {
			/** @type {'all'|'equips'} 当前打开的物品页面是道具页还是装备页 */
			type: 'all',
			/** @type {'toolBox'|'equipBox'} 当前选中的物品所在位置 */
			selectType: 'toolBox',
			/** @type {string} 当前选中的物品ID */
			itemId: '',
			/** @type {undefined|ItemBoxBack} 物品页面的背景 */
			_back: undefined,
			/** @type {undefined|ToolInventory} 道具背包 */
			_toolInv: undefined,
			/** @type {undefined|EquipInventory} 装备背包 */
			_equipInv: undefined,
			/** @type {undefined|ItemInfoBox} 右侧显示选中物品详细信息的页面 */
			_itemInfoBoard: undefined,
			/** @type {undefined|EquipChangeBoard} 显示已穿戴装备的面板 */
			_equipChangeBoard: undefined,
			/** 物品页面的背景 */
			get back() {
				if (!this._back) {
					this._back = new ItemBoxBack();
					const switchModeBtn = new SwitchBtn(385, 5, 24, 24, { strokeStyle: ' #8B4513', fillStyle: ' #D2691E' });
					// 背景上的按钮不需要随着itemId切换
					const exitBtn = new ExitBtn(385, 385, 24, 24);
					const allBtn = new ClassifyBtn(20, 10, 44, 24, "全部", "all"),
						toolsBtn = new ClassifyBtn(80, 10, 44, 24, "消耗", "tools"),
						constantsBtn = new ClassifyBtn(140, 10, 44, 24, "永久", "constants");
					exitBtn.event = () => exit();
					this._back.initBtnList([['switchModeBtn', switchModeBtn], ['exitBtn', exitBtn], ['allBtn', allBtn],
					['toolsBtn', toolsBtn], ['constantsBtn', constantsBtn]]);
				}
				return this._back;
			},
			/** 道具背包 */
			get toolInv() {
				if (!this._toolInv) {
					this._toolInv = new ToolInventory(15, 40, 225, 360, 137);
					/** @type {[number|string, ButtonBaseClass][]} */const btnArr = [];
					for (let i = 0; i < this._toolInv.pageCap; i++) {
						btnArr.push([i, new ItemBox(0, i * this._toolInv.oneItemHeight, this._toolInv.w, this._toolInv.oneItemHeight)])
					}
					const [pgDown, pgUp] = [new ArrowBtn(5, 335, 20, 20, 'left'), new ArrowBtn(200, 335, 20, 20, 'right')];
					pgDown.event = () => { globalUI.toolInv.pageDown(); redraw(); }
					pgUp.event = () => { globalUI.toolInv.pageUp(); redraw(); }
					btnArr.push(['pgDownBtn', pgDown]); // 这里不能使用core.push，否则会丢失类的方法 @todo 修复此bug
					btnArr.push(['pgUpBtn', pgUp]);
					this._toolInv.initBtnList(btnArr);
				}
				return this._toolInv;
			},
			/** 装备背包 */
			get equipInv() {
				if (!this._equipInv) {
					this._equipInv = new EquipInventory(15, 160, 225, 240, 137);
					/** @type {[number|string, ButtonBaseClass][]} */const btnArr = [];
					for (let i = 0; i < this._equipInv.pageCap; i++) {
						btnArr.push([i, new ItemBox(0, i * this._equipInv.oneItemHeight, this._equipInv.w, this._equipInv.oneItemHeight)])
					}
					const [pgDown, pgUp] = [new ArrowBtn(5, 215, 20, 20, 'left'), new ArrowBtn(200, 215, 20, 20, 'right')];
					pgDown.event = () => { globalUI.equipInv.pageDown(); redraw(); }
					pgUp.event = () => { globalUI.equipInv.pageUp(); redraw(); }
					btnArr.push(['pgDownBtn', pgDown]);
					btnArr.push(['pgUpBtn', pgUp]);
					this._equipInv.initBtnList(btnArr);
				}
				return this._equipInv;
			},
			/** 物品背包 */
			get itemInv() {
				return (this.type === 'all') ? this.toolInv : this.equipInv;
			},
			/** 右侧显示选中物品详细信息的页面 */
			get itemInfoBoard() {
				if (!this._itemInfoBoard) {
					this._itemInfoBoard = new ItemInfoBox(240, 0, core.__PIXELS__ - 240, core.__PIXELS__);
					const [hideBtn, markBtn] = [new HideBtn(20, 380, 46, 24), new MarkBtn(80, 380, 46, 24)];
					hideBtn.event = () => {
						hideItem(globalUI.itemId);
						this.itemInv.updateItemList();
						redraw();
					}
					markBtn.event = () => {
						markItem(globalUI.itemId);
						this.itemInv.updateItemList();
						redraw();
					}
					const showHideBtn = new ShowHideBtn(20, 350, 95, 18);
					const setHotkeyBtn = new IconBtn(145, 60, 24, 24, 'keyboard');
					setHotkeyBtn.event = () => {
						if (!globalUI.itemId) return;
						[globalUI.back, globalUI.itemInv, globalUI.equipChangeBoard, globalUI.itemInfoBoard].forEach((menu) => {
							if (menu) menu.endListen();
						});
						const hotkeySelect = hotkeySelectFactory(globalUI.itemId);
						hotkeySelect.init();
					}
					this._itemInfoBoard.initBtnList([['hideBtn', hideBtn], ['markBtn', markBtn], ['showHideBtn', showHideBtn],
					['setHotkeyBtn', setHotkeyBtn]]);
				}
				return this._itemInfoBoard;
			},
			get equipChangeBoard() {
				if (!this._equipChangeBoard) {
					this._equipChangeBoard = new EquipChangeBoard(7, 10, 240, 125, 137);
					const config = { marginLeft: 4, marginTop: 3, marginRight: 2 };
					const [pgDown, pgUp] = [new ArrowBtn(0, 56, 14, 14, 'left', config), new ArrowBtn(222, 56, 14, 14, 'right', config)];
					pgDown.event = () => { globalUI.equipChangeBoard.pageDown(); redraw(); };
					pgUp.event = () => { globalUI.equipChangeBoard.pageUp(); redraw(); };
				}
				return this._equipChangeBoard;
			}
		}

		/** @param {'all'|'equips'} currType  */
		function drawItemBox(currType) {
			if (globalUI._toolInv && globalUI._toolInv.onDraw && currType === globalUI.type) {
				clearAll();
				return;
			}
			clearAll();
			core.lockControl();
			globalUI.type = currType;
			globalUI.itemInv.updateItemList();
			globalUI.itemInv.focus(globalUI.itemInv.index);
			initAll();
		}
		// #endregion
	},
	"autoChangeEquip": function () {
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
					res(void 0);
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
			let equipList = Array(equipNameList.length).fill(void 0).map(() => new Set([null]));

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
			/** @type {Set<string>} */
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
	"customizableToolBar": function () {
		// 自定义工具栏显示项
		// 本插件需要配合main.js, control.js等的修改
		// 新的逻辑如下：
		// 函数_updateStatusBar_setToolboxIcon在updateStatusBar中调用，仅用于切换录像replay/pause，和计算几个图标的透明度
		// setToolbarButton根据输入的类型重新向状态栏填入元素
		// resize添加一个只刷新工具栏的模式，此外，resize不调用setToolbarButton，相反，setToolbarButton后调用resize
		// 以下地方调用setToolbarButton: hard的点击事件，回放录像的进入/退出事件
		// 要注意一点, floor是不能作为toolBar元素的，statuBar具有同id元素，样式会相互冲突 复制了一个外形一样的图标叫view，作为浏览地图按钮

		/**
		 * PC 默认6个键且不需要切入数字键的模式 最多9个键 手机 默认9个键 最多9个键(手机理论上可以塞10个键，但是懒得判定了)
		 * normal:普通模式 num:按下数字键切换到的模式 replay:录像模式 opacity:透明度
		 */
		const defaultConfig = {
			normal: {
				vertical: ['book', 'fly', 'toolbox', 'keyboard', 'shop', 'save', 'load', 'settings', 'rollback'],
				horizontal: ['book', 'fly', 'toolbox', 'save', 'load', 'settings']
			},
			num: {
				vertical: ['btn1', 'btn2', 'btn3', 'btn4', 'btn5', 'btn6', 'btn7', 'btn8', 'btnAlt'],
				horizontal: ['btn1', 'btn2', 'btn3', 'btn4', 'btn5', 'btn6', 'btn7', 'btn8', 'btnAlt']
			},
			replay: {
				vertical: ['play', 'stop', 'rewind', 'book', 'view', 'speedDown', 'speedUp', 'single'],
				horizontal: ['play', 'stop', 'rewind', 'speedDown', 'speedUp', 'book']
			},
			hide: {
				vertical: [], horizontal: [],
			}
		};

		function isVertical() {
			return core.domStyle.isVertical || core.flags.extendToolbar;
		}

		function getToolBarConfig(type) {
			const currObj = core.getLocalStorage('toorBarConfig' + type, defaultConfig[type]);
			return isVertical() ? currObj.vertical : currObj.horizontal;
		}
		this.getToolBarConfig = getToolBarConfig;

		/**
		 * 
		 * @param {string} type 
		 * @param {number} index 
		 * @param {string} value 
		 * @example core.setToolBarConfig('normal', 3, null)
		 */
		function setToolBarConfig(type, index, value) {
			const allToolType = ['normal', 'num', 'replay'];
			const allTools = ['book', 'fly', 'toolbox', 'keyboard', 'shop', 'save', 'load', 'settings', 'rollback', 'undoRollback',
				'btn1', 'btn2', 'btn3', 'btn4', 'btn5', 'btn6', 'btn7', 'btn8', 'btn9', 'btnAlt',
				'equipbox', 'floor', 'play', 'rewind', 'speedDown', 'speedUp', 'stop', 'single', 'view'];
			if (!allToolType.includes(type) || index < 0 || index > 8) {
				core.drawFailTip('请选中工具栏的一个合法位置作为目标点!');
				return;
			}
			if (value !== 'delete' && !allTools.includes(value)) {
				core.drawFailTip('请选中一个图标作为替换目标!');
				return;
			}
			const toorBarConfig = core.getLocalStorage('toorBarConfig' + type, defaultConfig[type]);
			const key = isVertical() ? 'vertical' : 'horizontal';
			if (type === 'replay'
				&& (['fly', 'shop', 'load', 'settings', 'btnAlt', 'rollback', 'undoRollback', 'btnAlt'].includes(value))) {
				core.drawFailTip('该按钮不允许放在录像模式下！');
				return;
			} // 录像模式下的按键处理有一套专门的逻辑，在_sys_onkeyUp_replay，实际上并不能读取自动档
			if (type !== 'replay' && ['play', 'stop', 'rewind', 'speedDown', 'speedUp', 'single'].includes(value)) {
				core.drawFailTip('该按钮不允许放在非录像模式下！');
				return;
			}

			if (value === 'delete') toorBarConfig[key].splice(index, 1);
			else {
				if (index > toorBarConfig[key].length) {
					core.drawFailTip('按钮中间不能有空白!');
					return;
				}
				const oldIndex = toorBarConfig[key].indexOf(value);
				if (oldIndex !== -1) { // 如果目标位置有图标，两者交换
					if (toorBarConfig[key][index] === value) return;
					const aimTool = toorBarConfig[key][index];
					toorBarConfig[key][index] = value;
					toorBarConfig[key][oldIndex] = aimTool;
				}
				else toorBarConfig[key][index] = value;
			}
			core.setLocalStorage('toorBarConfig' + type, toorBarConfig);
			setToolbarButton(core.domStyle.toolbarBtn);
		}
		this.setToolBarConfig = setToolBarConfig;

		function resetToolBarConfig() {
			for (let type in defaultConfig) {
				if (!defaultConfig.hasOwnProperty(type)) return;
				const toorBarConfig = core.getLocalStorage('toorBarConfig' + type, defaultConfig[type]);
				core.setLocalStorage('toorBarConfig' + type, toorBarConfig);
			}
		}
		this.resetToolBarConfig = resetToolBarConfig;

		/**
		 * 
		 * @param {'normal'|'num'|'replay'|'hide'} type 
		 */
		function setToolbarButton(type) {
			if (main.replayChecking) return; // 录像验证必须干掉此函数 因为它操作了DOM
			const currList = getToolBarConfig(type);
			if (!currList) return;
			const fragment = document.createDocumentFragment();
			for (let i = 0, l = currList.length; i < l; i++) {
				const iconId = currList[i];
				const currEle = core.statusBar.image[iconId];
				if (!currEle) continue;
				currEle.style.display = 'block';
				fragment.appendChild(currEle);
			}
			if (type !== "hide") {
				core.domStyle.toolbarBtn = type;
			}
			core.domStyle.toolsCount = currList.length;
			fragment.appendChild(core.dom.hard); // 难度一定会显示 因为难度所在位置要用于切换常规模式和数字模式 难度的尺寸是动态决定的
			core.dom.toolBar.innerHTML = '';
			core.dom.toolBar.appendChild(fragment);
			core.control.resize('tools'); // 在这里计算难度的尺寸
		}
		this.setToolbarButton = setToolbarButton;
	},
	"setting": function () {
		// 自绘设置界面
		// 请保持本插件在所有插件的最下方

		/**
		 * 本插件的修改方法：如果您了解样板的绘制API，基础的JS和面向对象，您可以轻松读懂和修改本插件。否则，您可以借助AI辅助阅读。
		 * 以下给出一些快速修改的参考
		 * 1.如何了解选项的效果，及修改已有的选项：找到下方如下代码段:
			const settingMap = new Map([
			['autoGet', new Setting(   // 'autoGet'为其在settingMap中对应的键名
				() => '自动拾取:' + (core.getFlag('autoGet', false) ? '开' : '关'),  // 此项填一个函数，返回一个字符串，为该选项显示的文字内容
				() => invertFlag('autoGet'),  // 此项填一个函数，为点击该选项执行的效果
				'每走一步，自动拾取当前层可获得的道具。',  // 此项填一个字符串，为该选项的说明文本
				true,  // 此项控制点击该选项的操作是否计入录像。请勿计入任何DOM操作。
			)],
			// ...some Content
			]);
			将对应位置的数组修改为
			['autoGet', new Setting(  
				() => '点我加100血',  
				() => { core.status.hero.hp += 100; core.updateStatusBar(); },  
				'点击该选项加100血',  
				true,  // 此项控制点击该选项的操作是否计入录像。请勿计入任何DOM操作。
			)],
			应用该修改后，选项“自动拾取”效果改为点1次加100血。
		 * 2.如何删除和添加已有的选项
			以删除“自动拾取”这个选项为例。查找可知，“自动拾取”在settingMap中对应的键名为'autoGet'
			在本插件最下方找到如下代码段
				gamePlayMenu.initBtnList([
				['1,1', new SettingButton(40, 180, 150, 30, 'autoGet')], 
				// ...some Content
			]);
			该按钮在此被添加到子菜单gamePlayMenu（功能）中
			删除 ['1,1', new SettingButton(40, 180, 150, 30, 'autoGet')], 这一行，自动拾取按钮将消失。
			但同时，相应按钮的位置将会空缺。
			如果想要添加按钮，上面的数组中，第一项'1,1'表示按钮所在的行和列，仅影响按下方向键时光标的移动
			按钮在画面中视觉上所处的位置为(40, 180), 尺寸为(150, 30),对应的settingMap中的数据索引为'autoGet'
			根据以上原则来修改和添加自己的按钮
			重要：为保险起见，您应当不仅删除按钮的入口，还删除按钮的效果，方法见上一条
		 * 3.如何删除和添加子菜单
			下列代码段控制子菜单的绘制：
			const settingMenu = new SettingMenu([gamePlayMenu, gameViewMenu, keyMenu, consoleMenu], 0, ctx);

			const gamePlayBtn = new ChoiceButton(32, 40, 46, 24, '功能', 0),
				gameViewBtn = new ChoiceButton(92, 40, 46, 24, '音画', 1),
				keyBtn = new ChoiceButton(152, 40, 46, 24, '按键', 2),
				consoleBtn = new ChoiceButton(212, 40, 66, 24, '控制台', 3);
			settingMenu.initBtnList([
			[0, gamePlayBtn],
			[1, gameViewBtn],
			[2, keyBtn],
			[3, consoleBtn],
			['quit', quit]
			]);
			删除consoleBtn的声明和引用，就能从设置界面中去掉控制台菜单。
			下面演示如何添加一个自己的菜单，添加下列代码段：
			const myMenu = new SettingOnePage('myContent');

			然后在settingMenu中加入该子菜单，如下：
			const settingMenu = new SettingMenu([gamePlayMenu, gameViewMenu, keyMenu, consoleMenu, myMenu], 0, ctx);

			在画面中添加该菜单的入口：
			const myBtn = new ChoiceButton(272, 40, 86, 24, '我的菜单', 4);
			settingMenu.initBtnList([...
			,[4, myBtn],
			['quit', quit]
			]);
			但该菜单还没有任何内容，添加一个按钮，如下：
			myMenu.initBtnList([
			['1,1', new SettingButton(40, 180, 150, 30, 'autoGet')], 
			]);
		 */

		// #region 复写
		// 复写resize，保证屏幕变化时此画布表现正常 
		const originResize = core.control.resize;
		core.control.resize = function () {
			originResize.apply(core.control, arguments);
			const settingMenu = core.plugin.settingMenu;
			if (settingMenu && settingMenu.onDraw) settingMenu.drawContent();
		}
		// #endregion

		const { ButtonBase, RoundBtn, MenuBase } = core.plugin.uiBase;
		class MenuPage extends MenuBase {
			constructor(pageList, currPage, ctx) {
				super(ctx);
				/**
				 * 当前页面列表
				 * @type {Array<MenuBaseClass>}
				 */
				this.pageList = pageList;
				/**
				 * 当前页的序号
				 * @type {number}
				 */
				this.currPage = currPage || 0;
			}

			initOnePage(index) {
				if (index == null) index = this.currPage;
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
			 * @param {(ctx:string)=>void} [draw]  
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
				 * @type {((ctx:string)=>void )| undefined}
				 */
				this.draw = draw;
			}
		}

		// #region 跳过剧情相关设置
		function invertFlag(name) {
			core.setFlag(name, !core.getFlag(name, false));
		}

		function instantMove(fromX, fromY, aimX, aimY, keep, callback) {
			const [block, blockInfo] = core.maps._getAndRemoveBlock(fromX, fromY);
			if (keep) {
				core.setBlock(blockInfo.number, aimX, aimY);
				core.showBlock(aimX, aimY);
			}
			if (callback) callback();
		}

		function checkSkipFuncs() {
			const skipInfo = core.getLocalStorage('skip');

			const skipText = skipInfo === 'perform' || skipInfo === 'text';
			// 此函数用于检测是否处在录像模式下，是则将跳过所有非必要对话
			core.events.__action_checkReplaying = skipText ? function () {
				core.doAction();
				return true;
			}.bind(core.events) : events.prototype.__action_checkReplaying;

			const skipPeform = skipInfo === 'perform';
			core.maps.jumpBlock = skipPeform ? function (sx, sy, ex, ey, time, keep, callback) {
				return instantMove(sx, sy, ex, ey, keep, callback);
			}.bind(core.maps) : maps.prototype.jumpBlock;

			core.maps.moveBlock = skipPeform ? function (x, y, steps, time, keep, callback) {
				maps.prototype.moveBlock(x, y, steps, 1, keep, callback);
			}.bind(core.maps) : maps.prototype.moveBlock;

			core.maps.drawAnimate = skipPeform ? function (name, x, y, alignWindow, callback) {
				if (callback) callback();
				return -1;
			}.bind(core.maps) : maps.prototype.drawAnimate;

			core.maps.drawHeroAnimate = skipPeform ? function (name, callback) {
				if (callback) callback();
				return -1;
			}.bind(core.maps) : maps.prototype.drawHeroAnimate;

			core.events.jumpHero = skipPeform ? function (ex, ey, time, callback) {
				const { x: sx, y: sy } = core.status.hero.loc;
				if (ex == null) ex = sx;
				if (ey == null) ey = sy;
				core.setHeroLoc('x', ex);
				core.setHeroLoc('y', ey);
				core.clearMap('hero');
				core.drawHero();
				if (callback) callback();
			}.bind(core.events) : events.prototype.jumpHero;

			core.events.vibrate = skipPeform ? function (direction, time, speed, power, callback) {
				if (callback) callback();
				return;
			}.bind(core.events) : events.prototype.vibrate;

			core.events._action_sleep = skipPeform ? function (data, x, y, prefix) {
				core.doAction();
			}.bind(core.events) : events.prototype._action_sleep;
		}
		this.checkSkipFuncs = checkSkipFuncs;
		// #endregion 
		// #region 设置的具体内容，与相应的录像注册
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
					const skipMode = core.getLocalStorage('skip', null);
					const index = list.indexOf(skipMode);
					let newIndex = index + 1;
					if (newIndex > list.length - 1) newIndex = 0;
					const newSkipMode = list[newIndex];
					core.setLocalStorage('skip', newSkipMode);
					core.plugin.checkSkipFuncs();
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
			/** @todo 该数字可以是小数，需要舍入 */
			['zoomIn', new Setting(
				() => ' <  放缩:' + Math.max(core.domStyle.scale, 1) + 'x',
				() => {
					core.actions._clickSwitchs_display_setSize(-1);
				},
				'放缩。',
				false, // 录像中不可录入任何DOM操作
			)],
			['zoomOut', new Setting(
				() => ' > ',
				() => {
					core.actions._clickSwitchs_display_setSize(1);
				},
				'放缩。',
				false,
			)],
			['HDCanvas', new Setting(
				() => '高清画面:' + (core.flags.enableHDCanvas ? '开' : '关'),
				core.actions._clickSwitchs_display_enableHDCanvas,
				'高清画面。本功能开关后刷新游戏才能看到效果。',
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
				() => {
					core.setLocalStorage('autoScale', core.getLocalStorage('autoScale') ? false : true);
				},
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
				() => {
					core.flags.leftHandPrefer = !core.flags.leftHandPrefer;
					core.setLocalStorage('leftHandPrefer', core.flags.leftHandPrefer);
				},
				'系统设置。左手模式下WASD将用于移动角色，IJKL对应于原始的WASD进行存读档等操作。',
				true,
			)],
			['setHotKey', new Setting(
				() => '',
				function (num) {
					core.utils.myprompt('输入物品名。名称（例如：破墙镐）或英文ID（例如：pickaxe）均可。', '', (value) => {
						const itemInfo = core.material.items;
						const aimItem = Object.values(itemInfo).find((item) => item.name === value || item.id === value);
						if (aimItem) {
							if (['constants', 'tools'].includes(aimItem.cls)) {
								for (let i = 1; i <= 9; i++) {
									if (i !== num && core.getLocalStorage('hotkey' + i) === aimItem.id) {
										core.setLocalStorage('hotkey' + i, null);
									} // 除默认外，一个物品只保留一个快捷键即可
								}
								core.setLocalStorage('hotkey' + num, aimItem.id);
								this.menu.drawContent();
							}
							else core.drawFailTip('错误：该类型的物品不支持快捷使用!');
						}
						else core.drawFailTip('错误：找不到该名称的物品!');
					}, () => { });
				},
				'给选定的数字键绑定一个可快捷使用的物品。',
				false,
				function (ctx) {
					const num = this.eventArgs[0];
					const item = core.getLocalStorage('hotkey' + num, null);
					let icon, itemName;
					if (item && core.material.items.hasOwnProperty(item)) {
						icon = item;
						itemName = core.material.items[item].name;
					}
					else {
						const itemMap = {
							'1': { icon: 'pickaxe', itemName: '破墙镐' }, '2': { icon: 'bomb', itemName: '炸弹' },
							'3': { icon: 'centerFly', itemName: '中心飞' }, '4': { itemName: '杂物' },
							'5': { itemName: '回退一步' }, '6': { itemName: '撤销回退' },
							'7': { itemName: '轻按' }
						};
						if (num >= '1' && num <= '9') {
							({ icon, itemName = '无' } = itemMap[num] || {});
						}
					}
					const keyIcon = 'btn' + num;
					core.drawIcon(ctx, keyIcon, this.x, this.y, 16, 16);
					const hasItem = core.material.items.hasOwnProperty(icon);
					if (hasItem) core.drawIcon(ctx, icon, this.x + 20, this.y, 16, 16);
					core.setTextAlign(ctx, 'left');
					core.setTextBaseline(ctx, 'alphabetic');
					core.fillText(ctx, itemName || '无', this.x + (hasItem ? 40 : 20), this.y + 14, 'white', '16px Verdana');
				}
			)],
			['clearHotKeys', new Setting(
				() => '',
				function () {
					for (let i = 1; i <= 9; i++) {
						core.setLocalStorage('hotkey' + i, null);
					}
					this.menu.drawContent();
					core.drawSuccessTip('快捷键已重置到默认状态。')
				},
				'重置本页面所有快捷键到默认状态。',
				false,
				function (ctx) {
					core.fillRoundRect(ctx, this.x, this.y, this.w, this.h, 3, ' #D3D3D3');
					core.strokeRoundRect(ctx, this.x, this.y, this.w, this.h, 3, ' #888888');
					core.fillText(ctx, '重置', this.x + 5, this.y + this.h / 2 + 5, ' #333333', '16px Verdana');
				},
			)],
			['debug_wallHacking', new Setting(
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
					core.utils.myprompt('输入要修改的属性名称', '', (value) => {
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
					}, () => { });
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
					core.utils.myprompt('输入要修改到的值', null, (input) => {
						const value = parseInt(input);
						if (!Number.isNaN(value)) {
							core.setFlag('debug_statusValue', value);
							this.menu.drawContent();
						}
						else {
							core.drawFailTip('错误：不合法的值!');
						}
					}, () => { });
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
					}, () => { });
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
					core.utils.myprompt('输入要修改到的值', null, (input) => {
						const value = parseInt(input);
						if (!Number.isNaN(value)) {
							core.setFlag('debug_itemValue', value);
							this.menu.drawContent();
						}
						else {
							core.drawFailTip('错误：不合法的值!');
						}
					}, () => { });
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
					}, () => { });
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
					}, () => { });
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

		// 注册点击SettingButton的行为cSet， 只有replay为真时计入录像
		core.registerReplayAction('cSet', (action) => {
			const strArr = action.split(':');
			if (strArr[0] !== 'cSet') return false;
			const btn = settingMap.get(strArr[1]);
			if (!btn || !btn.replay || strArr[1].startsWith('debug')) return false;

			let params = strArr.slice(2);

			if (params.length > 0) {
				btn.effect.apply(btn, params);
			} else {
				btn.effect.call(btn);
			}

			core.status.route.push(action);
			core.replay();
			return true;
		});
		// #endregion
		// #region 按钮类
		class SettingButton extends ButtonBase {
			/**
			 * @param {string[]} [eventArgs]
			 */
			constructor(x, y, w, h, name, eventArgs) {
				super(x, y, w, h);
				this.name = name;
				/*** @type {Array<string>}*/
				this.eventArgs = eventArgs || [];
				/** @type {Setting} */
				this.setting = settingMap.get(name);
				/** @type {string} 本设置在框中的说明文字*/
				this.text = this.setting.text;
				this.draw = () => {
					if (this.disable) return;
					const ctx = this.ctx;
					// 取消注释下面这一句将显示所有按钮的判定框
					// core.strokeRect(ctx, this.x, this.y, this.w, this.h, 'yellow');
					core.ui.fillText(ctx, this.setting.getName(),
						this.x, this.y + this.h / 2 + 5, 'white', '16px Verdana');
					const drawFunc = this.setting.draw;
					if (this.status === 'selected') {
						core.drawUIEventSelector(0, "winskin.png", this.x, this.y, this.w, this.h, 137);
					}
					if (drawFunc) drawFunc.apply(this, [ctx]);
				}
				this.event = () => {
					if (this.disable) return;
					this.setting.effect.apply(this, eventArgs);
					this.menu.drawContent();
					if (this.setting.replay) {
						let actionString = 'cSet:' + name;
						if (this.eventArgs.length > 0) {
							actionString += ':' + this.eventArgs.map(arg => encodeURIComponent(arg)).join(':');
						}
						core.status.route.push(actionString);
					}
				}
			}
		}

		class PageChangeBtn extends RoundBtn {
			constructor(x, y, w, h, text, index) {
				super(x, y, w, h, text);
				/** @type {SettingBase} */this.menu;
				this.index = index;
			}
		}

		class TextButton extends ButtonBase {
			constructor(x, y, w, h, text) {
				super(x, y, w, h);
				this.text = text;
				this.draw = () => {
					if (this.disable) return;
					core.ui.fillText(this.ctx, this.text,
						this.x + this.w / 2, this.y + this.h / 2 + 5, 'white', '16px Verdana');
				}
			}
		}

		class ToolBtn extends ButtonBase {
			constructor(x, y, w, h, icon, text, config) {
				super(x, y, w, h);
				/** @type {ToolBarConfigPage} */this.menu;
				this.icon = icon; // 特殊icon:delete 用于删除图标
				/** @todo 这里需要重构 */
				this.text = text;
				const { strokeStyle = 'white', fillStyle = 'white', selectedStyle = 'gold' } = config || {};
				this.draw = () => {
					const ctx = this.ctx;
					core.strokeRoundRect(ctx, this.x, this.y, this.w, this.h, 3, (this.menu.selectedTool === this.icon) ? selectedStyle : strokeStyle);
					if (this.icon === 'delete') {
						core.drawLine(ctx, this.x + 2, this.y + 2, this.x + this.w - 2, this.y + this.h - 2, 'red', 2);
						core.drawLine(ctx, this.x + 2, this.y + this.h - 2, this.x + this.w - 2, this.y + 2, 'red', 2);
					}
					else core.drawIcon(ctx, this.icon, this.x, this.y, this.w, this.h);
				};
				this.event = () => {
					this.menu.selectedTool = this.icon;
					this.menu.drawContent();
				};
			}
		}

		class ToolBarBtn extends ButtonBase {
			constructor(x, y, size, type, length, text) {
				super(x, y, length * size, size);
				/** @type {ToolBarConfigPage} */this.menu;
				this.type = type;
				this.length = length;
				/** @todo 这里需要重构 */
				this.text = text;

				this.draw = () => {
					const ctx = this.ctx;
					const squareSize = this.h;
					const toolBarConfig = core.plugin.getToolBarConfig(type);
					for (let i = 0; i < this.length; i++) {
						const style = (this.menu.type === type && this.menu.index === i) ? 'gold' : 'white';
						core.strokeRoundRect(ctx, this.x + squareSize * i + i, this.y, squareSize, squareSize, 3, style);
						core.drawIcon(ctx, toolBarConfig[i], this.x + squareSize * i + i, this.y, squareSize, squareSize);
					}
				}
				this.event = (x, y, px, py) => {
					const squareSize = this.h;
					const index = Math.floor((px - this.x) / squareSize);
					this.menu.type = type;
					this.menu.index = index;
					this.menu.drawContent();
				}
			}
		}

		function drawSetting(ctx) {
			core.strokeRoundRect(ctx, 0, 0, core.__PIXELS__, core.__PIXELS__, 5, "white", 2);
			core.fillRoundRect(ctx, 0, 0, core.__PIXELS__, core.__PIXELS__, 5, "gray");

			// 绘制设置说明的文本框
			core.strokeRoundRect(ctx, 20, 70, core.__PIXELS__ - 40, 70, 3, "white");
			core.fillRoundRect(ctx, 21, 71, core.__PIXELS__ - 42, 68, 3, " #555555");

			// 绘制设置的框体
			core.strokeRoundRect(ctx, 20, 150, core.__PIXELS__ - 40, 240, 3, "white");
			core.fillRoundRect(ctx, 21, 151, core.__PIXELS__ - 42, 238, 3, " #999999");

			core.setTextAlign(ctx, 'center');
			core.ui.fillText(ctx, "设置", core.__PIXELS__ / 2, 25, 'white', '20px Verdana');
		}
		// #endregion
		// #region 菜单类
		class SettingBase extends MenuPage {
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
						this.quit();
					}
				}
			}

			quit() {
				this.clear();
				setTimeout(core.unlockControl, 0); // 消抖，防止点击关闭按钮的一瞬间触发瞬移。
			}

			initBtnList(arr) {
				super.initBtnList(arr);
				this.btnList.forEach((btn) => {
					if (btn instanceof PageChangeBtn) {
						btn.event = function () {
							this.menu.changePage(this.index);
							this.menu.changeBtn(this);
							this.menu.drawContent();
						}
					}
				});
			}

			drawContent() {
				const ctx = core.createCanvas(this.name, this.x, this.y, this.w, this.h, 136);
				drawSetting(ctx);
				super.drawContent();
				this.initOnePage();
			}

			changeBtn(aimBtn) {
				this.btnList.forEach((btn) => {
					if (btn instanceof RoundBtn) {
						btn.status = aimBtn === btn ? 'selected' : 'none';
					}
				})
			}
		}

		/** 除自定义工具栏外的选项界面 */
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
				if (core.platform.isPC) this.onMoveEvent = (x, y, px, py) => {
					const btnNow = this.selectedBtn;
					// 先检测，如果还在当前已选中的按钮范围内，则什么也不做
					if (btnNow) {
						if (px >= btnNow.x && px <= btnNow.x + btnNow.w && py > btnNow.y && py <= btnNow.y + btnNow.h)
							return;
					}
					this.btnList.forEach((btn, pos) => {
						if (btn.disable) return;
						if (px >= btn.x && px <= btn.x + btn.w && py > btn.y && py <= btn.y + btn.h) {
							if (btnNow !== btn) this.focus(btn, pos);
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
				this.btnList.forEach((currBtn) => {
					currBtn.status = (currBtn === button) ? 'selected' : 'none';
				})
				this.text = button.text;
				this.drawContent();
			}

			drawContent() {
				core.createCanvas(this.name, 0, 0, core.__PIXELS__, core.__PIXELS__, 136);
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
					case 'toolBarConfig':
						core.setTextAlign(this.name, 'left');
						core.fillText(this.name, '常规', 40, 175, ' #FFE4B5', '16px Verdana');
						core.fillText(this.name, '数字', 40, 205, ' #FFE4B5', '16px Verdana');
						core.fillText(this.name, '录像', 40, 235, ' #FFE4B5', '16px Verdana');
						core.fillText(this.name, '可选按钮', 40, 265, ' #FFE4B5', '16px Verdana');
						break;
					case 'console':
						const ctx = this.name;
						const consoleWarnText =
							"本页面的功能仅供调试用。使用后相应存档将变红，录像不能通过，且无法提交。请读档到普通存档后正常游玩方可提交。";
						core.setTextAlign(this.name, 'left');
						core.setTextBaseline(ctx, 'alphabetic');
						core.fillText(this.name, "本页面的功能仅供调试用。使用后相应存档将变红，录像", 30, 170, " #FFC0CB", '14px Verdana');
						core.fillText(this.name, "不能通过，且无法提交。请读档到普通存档后正常游玩方", 30, 190, " #FFC0CB", '14px Verdana');
						core.fillText(this.name, "可提交。", 30, 210, " #FFC0CB", '14px Verdana');
						core.fillText(this.name, "属性", 45, 264, 'white', '16px Verdana');
						core.fillText(this.name, "设为", 170, 264, 'white', '16px Verdana');
						core.fillText(this.name, "物品", 45, 290, 'white', '16px Verdana');
						core.fillText(this.name, "数量设为", 170, 290, 'white', '16px Verdana');
						core.fillText(this.name, "变量", 45, 316, 'white', '16px Verdana');
						core.fillText(this.name, "设为", 170, 316, 'white', '16px Verdana');
						break;
				}
			}

			clear() {
				core.clearUIEventSelector(0); // 光标的绘制在按钮中进行
				super.clear();
			}
		}

		/** 自定义工具栏界面 */
		class ToolBarConfigPage extends SettingOnePage {
			constructor(name) {
				super(name);
				/** 当前选中的图标 */this.selectedTool = 'none';
				/** 当前选中了哪个类型的工具栏 */this.type = 'none';
				/** 当前选中工具栏哪个位置(1-9) */this.index = -1;
				this.clickEvent = (x, y, px, py) => {
					this.btnList.forEach((btn, pos) => {
						if (btn.disable) return;
						if (px >= btn.x && px <= btn.x + btn.w && py > btn.y && py <= btn.y + btn.h) {
							btn.event(x, y, px, py);
							if (btn instanceof ToolBtn) this.text = btn.text;
						}
					});
				}
				this.keyEvent = () => { }; /** 这个页面没有按键事件，因为有两类按钮可以同时被选中，没想好怎么弄 */
				if (core.platform.isPC) this.onMoveEvent = () => { }; /** 这里滚轮事件体验过于灵活，不利于选中想要的图标 */
			}
		}
		// #endregion

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
				['3,1', new SettingButton(330, 180, 25, 25, 'zoomOut')],
				['2,2', new SettingButton(220, 205, 150, 25, 'autoScale')],
				['2,3', new SettingButton(220, 230, 150, 25, 'enableEnemyPoint')],
				['2,4', new SettingButton(220, 255, 150, 25, 'displayCritical')],
				['2,6', new SettingButton(220, 325, 150, 25, 'se')],
			]);

			const keyMenu = new SettingOnePage('key');
			keyMenu.initBtnList([
				['1,1', new SettingButton(40, 160, 150, 25, 'leftHand')],
				['1,2', new SettingButton(40, 220, 150, 25, 'setHotKey', ['1'])],
				['2,2', new SettingButton(220, 220, 150, 25, 'setHotKey', ['2'])],
				['1,3', new SettingButton(40, 250, 150, 25, 'setHotKey', ['3'])],
				['2,3', new SettingButton(220, 250, 150, 25, 'setHotKey', ['4'])],
				['1,4', new SettingButton(40, 280, 150, 25, 'setHotKey', ['5'])],
				['2,4', new SettingButton(220, 280, 150, 25, 'setHotKey', ['6'])],
				['1,5', new SettingButton(40, 310, 150, 25, 'setHotKey', ['7'])],
				['2,5', new SettingButton(220, 310, 150, 25, 'setHotKey', ['8'])],
				['1,6', new SettingButton(40, 340, 150, 25, 'setHotKey', ['9'])],
				['2,6', new SettingButton(300, 350, 42, 25, 'clearHotKeys')],
			]);
			// 名字不能叫toolBar 画布toolBar被系统占了
			const toolBarMenu = new ToolBarConfigPage('toolBarConfig');
			const changeToolBarBtn = new RoundBtn(320, 158, 42, 24, '执行', -1);
			changeToolBarBtn.event = function () {
				core.setToolBarConfig(this.menu.type, this.menu.index, this.menu.selectedTool);
				this.menu.drawContent();
			}.bind(changeToolBarBtn);
			toolBarMenu.initBtnList([
				['1,1', new ToolBarBtn(80, 158, 24, 'normal', 9, '常规模式下显示在工具栏中的图标。')],
				['1,2', changeToolBarBtn],
				['2,1', new ToolBarBtn(80, 188, 24, 'num', 9, '数字模式下显示在工具栏中的图标。')],
				['3,1', new ToolBarBtn(80, 218, 24, 'replay', 9, '录像模式下显示在工具栏中的图标。')],
				['5,1', new ToolBtn(40, 275, 24, 24, 'book', '打开怪物手册')],
				['5,2', new ToolBtn(70, 275, 24, 24, 'fly', '进行楼层传送')],
				['5,3', new ToolBtn(100, 275, 24, 24, 'toolbox', '打开物品背包')],
				['5,4', new ToolBtn(130, 275, 24, 24, 'equipbox', '打开装备背包')],
				['5,5', new ToolBtn(160, 275, 24, 24, 'keyboard', '打开虚拟键盘')],
				['5,6', new ToolBtn(190, 275, 24, 24, 'shop', '打开快捷商店')],
				['5,7', new ToolBtn(220, 275, 24, 24, 'save', '存档')],
				['5,8', new ToolBtn(250, 275, 24, 24, 'load', '读档')],
				['5,9', new ToolBtn(280, 275, 24, 24, 'settings', '打开系统设置')],
				['5,10', new ToolBtn(310, 275, 24, 24, 'rollback', '读取自动存档')],
				['5,11', new ToolBtn(340, 275, 24, 24, 'undoRollback', '取消读取自动存档')],
				['6,1', new ToolBtn(40, 305, 24, 24, 'btn1', '数字键1')],
				['6,2', new ToolBtn(70, 305, 24, 24, 'btn2', '数字键2')],
				['6,3', new ToolBtn(100, 305, 24, 24, 'btn3', '数字键3')],
				['6,4', new ToolBtn(130, 305, 24, 24, 'btn4', '数字键4')],
				['6,5', new ToolBtn(160, 305, 24, 24, 'btn5', '数字键5')],
				['6,6', new ToolBtn(190, 305, 24, 24, 'btn6', '数字键6')],
				['6,7', new ToolBtn(220, 305, 24, 24, 'btn7', '数字键7')],
				['6,8', new ToolBtn(250, 305, 24, 24, 'btn8', '数字键8')],
				['6,9', new ToolBtn(280, 305, 24, 24, 'btn9', '数字键9')],
				['6,10', new ToolBtn(310, 305, 24, 24, 'btnAlt', '开关Alt模式(需要配合数字键使用)')],
				['7,1', new ToolBtn(40, 335, 24, 24, 'play', '播放/暂停录像')],
				['7,2', new ToolBtn(70, 335, 24, 24, 'stop', '停止播放录像')],
				['7,3', new ToolBtn(100, 335, 24, 24, 'rewind', '录像模式下回退')],
				['7,4', new ToolBtn(130, 335, 24, 24, 'speedDown', '减速录像(最低0.2倍)')],
				['7,5', new ToolBtn(160, 335, 24, 24, 'speedUp', '加速录像(最高24倍)')],
				['7,6', new ToolBtn(190, 335, 24, 24, 'single', '单步播放录像')],
				['7,7', new ToolBtn(220, 335, 24, 24, 'view', '浏览地图')],
				['7,8', new ToolBtn(250, 335, 24, 24, 'delete', '删除已有图标')],
			])

			const consoleMenu = new SettingOnePage('console');
			consoleMenu.initBtnList([
				['1,1', new SettingButton(40, 220, 150, 25, 'debug_wallHacking')],
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
			const settingMenu = new SettingBase([gamePlayMenu, gameViewMenu, keyMenu, toolBarMenu, consoleMenu], 0, ctx);

			// 主页面的按钮列表
			const gamePlayBtn = new PageChangeBtn(32, 40, 46, 24, '功能', 0),
				gameViewBtn = new PageChangeBtn(92, 40, 46, 24, '音画', 1),
				keyBtn = new PageChangeBtn(152, 40, 46, 24, '按键', 2),
				toolBarBtn = new PageChangeBtn(212, 40, 66, 24, '工具栏', 3),
				consoleBtn = new PageChangeBtn(292, 40, 66, 24, '控制台', 4);
			const quit = new TextButton(360, 10, 45, 25, '[退出]');
			quit.event = () => { settingMenu.quit(); }

			settingMenu.initBtnList([[0, gamePlayBtn], [1, gameViewBtn],
			[2, keyBtn], [3, toolBarBtn], [4, consoleBtn],
			['quit', quit]]);

			// 放缩时重绘整个大menu
			core.plugin.settingMenu = settingMenu;
			// 设置初始时选中的按键为第一个按键
			settingMenu.changeBtn(gamePlayBtn);

			settingMenu.init();
		}
		// @todo 新版存档界面
	}
}