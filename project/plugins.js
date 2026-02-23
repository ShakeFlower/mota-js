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
				if (x > 32 * core.bigmap.posX + core.__PIXELS__ + 32 || x + width < 32 * core.bigmap.posX - 32 ||
					y > 32 * core.bigmap.posX + core.__PIXELS__ + 32 || y + height < 32 * core.bigmap.posY - 32) {
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
			core.getItemDetail(floorId); // 宝石血瓶详细信息
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
		const ctxName = 'autoClear';

		// 每走一步后自动拾取的判定要放在阻击结算之后，见libs，并不写在本插件当中

		this.autoClear = auto;

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
				has(floor.afterBattle[loc]) || has(floor.beforeBattle[loc]) ||
				has(e.beforeBattle) || has(e.afterBattle) ||
				has(floor.events[loc]) || willLvUp(e.exp); // 防止有升级后事件

			// 有事件，不清
			if (hasEvent) return false;

			const cache = core.status.checkBlock.cache;
			const hasGuards = has(cache) && has(cache[loc]) &&
				has(cache[loc]["guards"]) && cache[loc]["guards"].length > 0; // 该敌人会被支援
			if (hasGuards) return false;

			// 有特定特殊属性的怪不清
			if (
				core.hasSpecial(e.special, 12) || // 中毒
				core.hasSpecial(e.special, 13) || // 衰弱
				core.hasSpecial(e.special, 14) || // 诅咒
				core.hasSpecial(e.special, 19) || // 自爆	
				core.hasSpecial(e.special, 21) || // 退化
				core.hasSpecial(e.special, 26) || // 支援
				core.hasSpecial(e.special, 27) || // 捕捉:逻辑上应该让怪物来找角色
				core.hasSpecial(e.special, 28) || // 追猎:逻辑上应该让怪物来找角色
				core.hasSpecial(e.special, 29) // 败移:特殊战后事件
			) {
				return false;
			}
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
		function canGetItem(item, loc, floorId = core.status.floorId) {
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
			const floor = core.floors[floorId];
			if (has(floor.afterGetItem[loc])) return false;
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

		class AttractAnimate {
			constructor() {
				this.name = 'attractAnimate';
				this.isPlaying = false;
				this.nodes = [];
				this.lastTime = -1;
				this.thr = 5; // 缓动比例倒数，越大移动越慢
			}

			add(id, x, y, callback) {
				if (core.isReplaying()) return;
				this.nodes.push({ id, x, y, callback });
			}

			start() {
				if (this.isPlaying) return;
				if (core.isReplaying()) return;
				if (core.getLocalStorage('skipPerform')) return;
				this.isPlaying = true;
				core.registerAnimationFrame(this.name, true, this.update.bind(this));
				this.ctx = core.createCanvas(this.name, 0, 0, core.__PIXELS__, core.__PIXELS__, 120);
			}

			remove() {
				core.unregisterAnimationFrame(this.name);
				core.deleteCanvas(this.name);
				this.isPlaying = false;
			}

			clear() {
				this.nodes = [];
				this.remove();
			}

			update(timeStamp) {
				const { name, thr, nodes } = this;

				if (this.lastTime < 0) this.lastTime = timeStamp;
				if (timeStamp - this.lastTime < 20) return;
				this.lastTime = timeStamp;

				core.clearMap(name);

				const heroCenterX = core.status.heroCenter.px - 16;
				const heroCenterY = core.status.heroCenter.py - 16;

				for (const n of nodes) {
					const dx = heroCenterX - n.x;
					const dy = heroCenterY - n.y;

					if (Math.abs(dx) <= thr && Math.abs(dy) <= thr) {
						n.dead = true;
					} else {
						n.x += ~~(dx / thr);
						n.y += ~~(dy / thr);
					}

					core.drawIcon(name, n.id, n.x, n.y, 32, 32);
				}

				// 过滤掉 dead 的节点并执行回调
				const remainingNodes = [];
				for (const n of nodes) {
					if (n.dead && n.callback) {
						n.callback();
					}
					if (!n.dead) {
						remainingNodes.push(n);
					}
				}
				this.nodes = remainingNodes;

				if (this.nodes.length === 0) {
					this.remove();
				}
			}
		}

		const animateHwnd = new AttractAnimate();

		/** 拾取单个物品的动画 */
		this.pickOneItemAnimate = function (id, x, y, callback) {
			if (core.isReplaying()) return;
			animateHwnd.add(id, x, y, callback);
			animateHwnd.start();
		};
		/** 在每次切换楼层后调用 */
		this.clearAttractAnimate = function () {
			animateHwnd.clear();
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
			const dir = /** @type {[direction, number, number][]} */ Object.entries(core.utils.scan).map(v => [v[0], v[1].x, v[1].y]);
			const floor = core.status.maps[floorId];

			/** @type {[number, number][]} */
			const queue = [
				[x, y]
			];
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
							if (!core.isReplaying()) animateHwnd.add(item.id, 32 * tx, 32 * ty);
							core.getItem(item.id, 1, tx, ty);
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
			if (!ctx) {
				core.createCanvas(ctxName, 0, 0, core.__PIXELS__, core.__PIXELS__, 75);
				core.setAlpha(ctxName, 0.6);
			}
			bfs(core.status.floorId, deep);
			if (!core.isReplaying()) animateHwnd.start();
			flags.__statistics__ = false;
			flags.__forbidSave__ = before;
			core.updateStatusBar();
		}
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
			const aim = 100 + x + Math.min(core.calWidth(ctxName, content, '16px Verdana'), 5000);
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
		/** 
		 * @typedef {(x:number,y:number,px:number,py:number)=>void} posFunc
		 */
		/** 按钮基类 */
		class ButtonBase {
			constructor(x, y, w, h) {
				this.x = x;
				this.y = y;
				this.w = w;
				this.h = h;
				this.disable = false;
				this.status = 'none';

				// 下面三项在initbtnMap时添加
				/** 
				 * @type {MenuBase} 所在的Menu，用于触发重绘等事件 
				 */
				// @ts-ignore 将在菜单初始化时传入
				this.menu;
				/** @type {string} 所在的Menu的画布名称 */
				this.ctx = '';
				/** @type {string|number} 自身在所在的Menu的btnMap中的索引 */
				this.key = '';

				/** @type {posFunc} */
				this.ondown = () => { };
				/** @type {posFunc|undefined} */
				this.onmove = undefined;
				/** @type {posFunc|undefined} */
				this.onup = undefined;
			}

			/** 绘制该按钮的外观
			 * @interface 
			 */
			draw() { }

			/** 默认为矩形判定区 */
			inRange(px, py) {
				return px >= this.x && px <= this.x + this.w && py >= this.y && py <= this.y + this.h;
			}
		}
		const KeyCodeEnum = {
			BackSpace: 8, Tab: 9, Enter: 13, Esc: 27, SpaceBar: 32,
			PageUp: 33, PageDown: 34, Left: 37, Up: 38, Right: 39,
			Down: 40, C: 67, Q: 81, T: 84,
		};

		/** @typedef {'ondown'|'onmove'|'onup'|'keyDown'|'keyUp'|'onmousewheel'} eventType  */
		class MenuBase {
			/** 
			 * @param {string} name 菜单名称，作为绘制画布时的名称
			 * @param {eventType[]} [toListen] 
			 * @param {number} [x] 
			 * @param {number} [y]
			 * @param {number} [w]
			 * @param {number} [h]
			 * @param {number} [zIndex]
			 */
			constructor(name, toListen, x, y, w, h, zIndex) {
				this.name = name;
				/** @type {Map<string|number, ButtonBase>} 本菜单上的按钮列表，每次绘制将触发按钮的draw事件 */
				this.btnMap = new Map();
				/** 当前画布是否正被绘制 */
				this.onDraw = false;
				/** @type {Set<eventType>} 当前画布需要监听的事件类型 */
				this.toListen = new Set(toListen);

				this.x = x ?? 0;
				this.y = y ?? 0;
				this.w = w ?? core.__PIXELS__;
				this.h = h ?? core.__PIXELS__;
				this.zIndex = zIndex ?? 136; // 136比uievent大1
			}

			// #region 监听事件
			/** 返回换算后的画布上的相对坐标 */
			convertCoordinate(px, py) {
				return [px - this.x, py - this.y];
			}

			/** 默认为矩形判定区 */
			inRange(px, py) {
				return px >= this.x && px <= this.x + this.w && py >= this.y && py <= this.y + this.h;
			}

			ondown(x, y, rawpx, rawpy) {
				if (!this.inRange(rawpx, rawpy)) return;
				const [px, py] = this.convertCoordinate(rawpx, rawpy);
				this.ondownEvent(x, y, px, py);
				this.ondownBtnEvent(x, y, px, py);
			}

			/** 点击画布自身触发的事件
			 *  @interface 
			 */
			ondownEvent(x, y, px, py) { }

			// btnMap 一个key指向一个对象 包含btn本身，对应事件，是否disable btn本身不包含event 由菜单赋予

			/** 点击画布的按钮触发的事件
			 * @interface 
			 */
			ondownBtnEvent(x, y, px, py) {
				this.btnMap.forEach((btn) => {
					if (btn.disable) return;
					if (btn.inRange(px, py)) {
						btn.ondown(x, y, px, py);
					}
				});
			}

			/** 屏幕被鼠标滑动或手指拖动时触发的事件
			 * @interface (x:number,y:number,px:number,py:number):void 
			 */
			onmove(x, y, rawpx, rawpy) {
				if (!this.inRange(rawpx, rawpy)) return;
				const [px, py] = this.convertCoordinate(rawpx, rawpy);
				this.onmoveEvent(x, y, px, py);
				this.onmoveBtnEvent(x, y, px, py);
			}

			onmoveEvent(x, y, px, py) { }

			onmoveBtnEvent(x, y, px, py) {
				this.btnMap.forEach((btn) => {
					if (btn.disable) return;
					if (btn.inRange(px, py) && btn.onmove) {
						btn.onmove(x, y, px, py);
					}
				});
			}

			/** 当屏幕被鼠标或手指放开时触发的事件
			 * @interface (x:number,y:number,px:number,py:number):void
			 */
			onup(x, y, rawpx, rawpy) {
				if (!this.inRange(rawpx, rawpy)) return;
				const [px, py] = this.convertCoordinate(rawpx, rawpy);
				this.onupEvent(x, y, px, py);
				this.onupBtnEvent(x, y, px, py);
			}

			onupEvent(x, y, px, py) { }

			onupBtnEvent(x, y, px, py) {
				this.btnMap.forEach((btn) => {
					if (btn.disable) return;
					if (btn.inRange(px, py) && btn.onup) {
						btn.onup(x, y, px, py);
					}
				});
			}

			/** 按键被按下时触发的事件
			 * @interface (keycode:number)=>void 
			 */
			keyDownEvent(keycode) { }

			/** 按键被放开时触发的事件
			 * @interface (keycode:number,altkey?:boolean,fromReplay?:boolean)=>void)
			 */
			keyUpEvent(keycode, altkey, fromReplay) { }

			/** 鼠标滚轮滚动时触发的事件
			 * @interface (direct:1|-1):void
			 */
			onmousewheelEvent(direct) { }
			// #endregion

			/** 
			 * @param {string | number} key
			 * @param {ButtonBase} btn
			 * @param {posFunc | {ondown:posFunc,onmove?:posFunc,onup?:posFunc}} [event]
			 */
			registerBtn(key, btn, event) {
				btn.menu = this;
				btn.ctx = this.name;
				btn.key = key;
				if (event == null) { }
				else if (typeof event === 'function') {
					btn.ondown = event;
				} else {
					const { ondown, onmove, onup } = event;
					btn.ondown = ondown;
					btn.onmove = onmove;
					btn.onup = onup;
				}
				this.btnMap.set(key, btn);
			}

			registerBtns(arr) {
				arr.forEach(ele => {
					const [key, btn, event] = ele;
					this.registerBtn(key, btn, event);
				});
			}

			// 创建并返回本菜单的画布
			createCanvas() {
				return core.createCanvas(this.name, this.x, this.y, this.w, this.h, this.zIndex);
			}

			drawButtonContent() {
				this.btnMap.forEach((button) => {
					if (!button.disable) button.draw();
				})
			}

			drawContent() {
				this.drawButtonContent();
				this.onDraw = true;
			}

			beginListen() {
				if (this.toListen.has('ondown')) core.registerAction('ondown', this.name, this.ondown.bind(this), 100);
				if (this.toListen.has('keyDown')) core.registerAction('keyDown', this.name, this.keyDownEvent.bind(this), 100);
				if (this.toListen.has('keyUp')) core.registerAction('keyUp', this.name, this.keyUpEvent.bind(this), 100);
				if (this.toListen.has('onmove')) core.registerAction('onmove', this.name, this.onmove.bind(this), 100)
				if (this.toListen.has('onup')) core.registerAction('onup', this.name, this.onup.bind(this), 100);
				if (this.toListen.has('onmousewheel')) core.registerAction('onmousewheel', this.name, this.onmousewheelEvent.bind(this), 100);
			}

			endListen() {
				core.unregisterAction('ondown', this.name);
				core.unregisterAction('keyDown', this.name);
				core.unregisterAction('keyUp', this.name);
				core.unregisterAction('onmove', this.name);
				core.unregisterAction('onup', this.name);
				core.unregisterAction('onmousewheel', this.name);
			}

			remove() {
				core.ui.deleteCanvas(this.name);
				this.onDraw = false;
			}

			clear() {
				this.endListen();
				this.remove();
			}

			init() {
				this.beginListen();
				this.drawContent();
			}
		}

		class Pagination extends MenuBase {
			constructor(pageList, currPage, name, toListen, x, y, w, h, zIndex) {
				super(name, toListen, x, y, w, h, zIndex);
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
				this.currPage = index;
				this.pageList[index].init();
			}

			changePage(num) {
				if (num !== this.currPage) {
					const beforeMenu = this.pageList[this.currPage];
					beforeMenu.clear();
				}
				this.initOnePage(num);
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

		// 圆角带文字的按钮
		class RoundBtn extends ButtonBase {
			constructor(x, y, w, h, text, config) {
				super(x, y, w, h);
				this.text = text;
				this.config = config || {};
			}

			draw() {
				const ctx = this.ctx;
				const { x, y, w, h } = this;
				const {
					fillStyle = 'rgb(204, 204, 204)', strokeStyle = 'black', fontStyle = 'black',
					selectedFillStyle = 'rgb(255, 51, 153)', selectedstrokeStyle = 'black', selectedFontStyle = 'white',
					radius = 3, lineWidth = 1, angle = null, font = '16px Verdana'
				} = this.config || {};
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
			}
		}

		class IconBtn extends ButtonBase {
			constructor(x, y, w, h, icon, config) {
				super(x, y, w, h);
				this.icon = icon;
				this.config = config || {};
			}

			draw() {
				const ctx = this.ctx;
				const { x, y, w, h } = this;
				const {
					strokeStyle = 'black', fillStyle = 'white',
					radius = 3, lineWidth = 1, angle = null, frame = 0,
					iconX = x, iconY = y, iconW = w, iconH = h,
					crossline1 = false, crossline2 = false, crossLineOffset = 2,
					crossLineStyle = 'red', crossLineWidth = 2,
				} = this.config || {};
				if (fillStyle !== 'none') core.fillRoundRect(ctx, x, y, w, h, radius, fillStyle, angle);
				if (strokeStyle !== 'none') core.strokeRoundRect(ctx, x, y, w, h, radius, strokeStyle, lineWidth, angle);
				core.drawIcon(ctx, this.icon, iconX, iconY, iconW, iconH, frame);
				if (crossline1) {
					core.drawLine(ctx, x + crossLineOffset, y + crossLineOffset,
						x + w - crossLineOffset, y + h - crossLineOffset,
						crossLineStyle, crossLineWidth);
				}
				if (crossline2) {
					core.drawLine(ctx, x + crossLineOffset, y + h - crossLineOffset,
						x + w - crossLineOffset, y + crossLineOffset,
						crossLineStyle, crossLineWidth);
				}
			}
		}

		class ExitBtn extends ButtonBase {
			constructor(x, y, w, h, config) {
				super(x, y, w, h);
				this.config = config || {};
			}

			draw() {
				const ctx = this.ctx;
				const {
					strokeStyle = ' #D32F2F', fillStyle = ' #EF5350', lineStyle = 'white',
					radius = 3, lineOffsetX = 5, lineWidthX = 3,
				} = this.config || {};
				const [x, y, w, h] = [this.x, this.y, this.w, this.h];
				core.fillRoundRect(ctx, x, y, w, h, radius, fillStyle);
				core.strokeRoundRect(ctx, x, y, w, h, radius, strokeStyle);
				core.drawLine(ctx, x + lineOffsetX, y + lineOffsetX, x + w - lineOffsetX, y + h - lineOffsetX, lineStyle, lineWidthX);
				core.drawLine(ctx, x + lineOffsetX, y + h - lineOffsetX, x + w - lineOffsetX, y + lineOffsetX, lineStyle, lineWidthX);
			}
		}

		class ArrowBtn extends ButtonBase {
			constructor(x, y, w, h, dir, config) {
				super(x, y, w, h);
				this.config = config || {};
				/** @type {'left'|'right'} */
				this.dir = dir;
			}

			draw() {
				const {
					marginLeft = 6, marginTop = 5, marginRight = 4,
					backStyle = 'gray', arrowStyle = 'black'
				} = this.config || {};
				const { x, y, w, h, ctx } = this;
				core.fillRoundRect(ctx, x, y, w, h, 3, backStyle);
				if (this.dir === 'left')
					core.fillPolygon(ctx, [
						[x + w - marginLeft, y + marginTop],
						[x + w - marginLeft, y + h - marginTop],
						[x + marginRight, y + h / 2]
					], arrowStyle);
				else if (this.dir === 'right')
					core.fillPolygon(ctx, [
						[x + marginLeft, y + marginTop],
						[x + marginLeft, y + h - marginTop],
						[x + w - marginRight, y + h / 2]
					], arrowStyle);
			}
		}
		this.uiBase = {
			ButtonBase, RoundBtn, IconBtn, ExitBtn,
			ArrowBtn, MenuBase, Pagination, KeyCodeEnum
		};
	},
	"newBackpackLook": function () {
		// 本插件定义了一些用于绘制的基类

		let __enable = true;
		if (!__enable) return;

		/** @todo 尝试干掉redraw */
		// #region 复写

		core.ui._drawToolbox = function () { drawItemBox('all'); }.bind(core.ui);
		core.ui._drawEquipbox = function () { drawItemBox('equips'); }.bind(core.ui);
		core.actions._keyDownToolbox = core.actions._keyDownEquipbox = function (keyCode) { return true; }.bind(core.actions);
		core.actions._clickToolbox = core.actions._clickEquipbox = function (x, y, px, py) { return true; }.bind(core.actions);
		core.actions._keyUpToolbox = core.actions._keyUpEquipbox = function (keyCode) { return true; }.bind(core.actions);
		// 暂不考虑修改core.status.event.id，该变量牵涉太多，作用不完全清楚
		// 录像模式下下列函数会进行检测，不处于特定模式时，阻止自定义监听事件 
		core.actions._checkReplaying = function () {
			if (core.isReplaying() && !UI._back?.onDraw &&
				['save', 'book', 'book-detail', 'viewMaps', 'toolbox', 'equipbox', 'text'].indexOf(core.status.event.id) < 0) {
				return true;
			}
			return false;
		}.bind(core.actions);

		const oriClosePanel = core.ui.closePanel;
		core.ui.closePanel = function () {
			oriClosePanel.apply(core.ui, [arguments]);
			UI.clearAll();
		}

		core.control._replayAction_item = function (action) {
			if (action.indexOf("item:") != 0) return false;
			const itemId = action.substring(5);
			if (!core.canUseItem(itemId)) return false;
			if (core.material.items[itemId].hideInReplay || core.status.replay.speed == 24) {
				core.useItem(itemId, false, core.replay);
				return true;
			}
			core.ui._drawToolbox(0);
			const itemInv = UI.itemInv;
			const totalIndex = itemInv.allItemList.indexOf(itemId);
			const page = Math.max(Math.ceil(totalIndex / itemInv.pageCap) - 1, 0);
			const currIndex = totalIndex - page * itemInv.pageCap;
			itemInv.page = page;
			itemInv.setIndex(currIndex);
			itemInv.drawContent();
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
			const { itemId, itemInv, equipSlots } = UI;
			const totalIndex = itemInv.allItemList.indexOf(itemId);
			const page = Math.max(Math.ceil(totalIndex / itemInv.pageCap) - 1, 0);
			const currIndex = totalIndex - page * itemInv.pageCap;
			itemInv.page = page;
			itemInv.setIndex(currIndex);
			itemInv.drawContent();
			equipSlots.drawContent();
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
				[UI._equipSlots, UI._equipInv, UI._itemInfo].forEach((menu) => {
					if (menu && menu.onDraw) menu.drawContent();
				});
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
			const { itemInv, equipSlots } = UI;
			const page = Math.max(Math.ceil(equipType / itemInv.pageCap) - 1, 0);
			const currIndex = equipType - page * itemInv.pageCap;
			itemInv.page = page;
			itemInv.setIndex(currIndex);
			itemInv.drawContent();
			equipSlots.drawContent();
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
			} else if (core.status.hero.items[cls]) {
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
			const { _back, itemInv, _equipSlots: _equipChangeBoard, _itemInfo: _itemInfoBoard } = UI;
			[_back, itemInv, _equipChangeBoard, _itemInfoBoard].forEach((menu) => { if (menu && menu.onDraw) menu.drawContent(); });
		}

		// #endregion
		const { ButtonBase, RoundBtn, IconBtn, ExitBtn, MenuBase, KeyCodeEnum } = core.plugin.uiBase;
		// #region 绘制用到的按钮类

		/** 隐藏物品的按钮 */
		class HideBtn extends RoundBtn {
			constructor(x, y, w, h, config) {
				super(x, y, w, h, '隐藏', config);
			}

			draw() {
				const itemId = UI.itemId;
				if (core.material.items[itemId]) {
					const hideInfo = core.getFlag('hideInfo', {});
					if (hideInfo.hasOwnProperty(itemId)) this.text = hideInfo[itemId] ? "显示" : "隐藏";
					else this.text = core.material.items[itemId].hideInToolbox ? "显示" : "隐藏";
				}
				super.draw();
			}
		}

		/** 置顶物品的按钮 */
		class MarkBtn extends RoundBtn {
			constructor(x, y, w, h, config) {
				super(x, y, w, h, '置顶', config);
			}

			draw() {
				const itemId = UI.itemId;
				const markedItems = core.getFlag('markedItems', []);
				this.text = markedItems.includes(itemId) ? "取消" : "置顶";
				super.draw();
			}
		}

		/** 切换到显示指定分类的物品(如：永久,消耗)的模式的按钮 */
		class ClassifyBtn extends RoundBtn {
			constructor(x, y, w, h, text, subType, config) {
				super(x, y, w, h, text, config);
				this.subType = subType;
			}

			draw() {
				const { type, toolInv } = UI;
				if (toolInv.subType === this.subType) this.status = 'selected';
				else this.status = "none";
				super.draw();
			}
		}

		/** 控制是否显示隐藏物品的按钮 */
		class ShowHideBtn extends ButtonBase {
			draw() {
				const ctx = this.ctx;
				const squareSize = this.h;
				core.strokeRect(ctx, this.x, this.y, squareSize, squareSize, 'black');
				core.fillRect(ctx, this.x + 1, this.y + 1, squareSize - 2, squareSize - 2, 'white');
				const font = core.ui._buildFont(this.h - 4);
				core.setTextAlign(ctx, 'left');
				core.setTextBaseline(ctx, 'middle');
				if (core.hasFlag('showHideItem')) core.fillText(ctx, '√', this.x + 3, this.y + 10, 'red', font);
				core.fillText(ctx, '查看隐藏', this.x + squareSize + 6, this.y + 10, 'white', font);
			}
		}

		/** 切换道具栏和装备栏的按钮 */
		class SwitchBtn extends IconBtn {
			constructor(x, y, w, h, config) {
				super(x, y, w, h, 'toolbox', config);
			}

			draw() {
				this.icon = (UI.type === 'all') ? 'toolbox' : 'equipbox';
				super.draw();
			}
		}

		class NoHoverBtn extends IconBtn {
			draw() {
				super.draw();
				const ctx = this.ctx;
				const { x, y, w, h } = this;
				core.drawImage(ctx, "mousewheel.png", x, y, w, h);
			}
		}

		class ArrowBtn extends ButtonBase {
			constructor(x, y, w, h, dir, config) {
				super(x, y, w, h);
				this.config = config || {};
				/** @type {'left'|'right'} */
				this.dir = dir;
			}

			draw() {
				const {
					marginLeft = 6, marginTop = 5, marginRight = 4,
					backStyle = 'gray', arrowStyle = 'black'
				} = this.config || {};
				const ctx = this.ctx;
				core.fillRoundRect(ctx, this.x, this.y, this.w, this.h, 3, backStyle);
				if (this.dir === 'left')
					core.fillPolygon(ctx, [
						[this.x + this.w - marginLeft, this.y + marginTop],
						[this.x + this.w - marginLeft, this.y + this.h - marginTop],
						[this.x + marginRight, this.y + this.h / 2]
					], arrowStyle);
				else if (this.dir === 'right')
					core.fillPolygon(ctx, [
						[this.x + marginLeft, this.y + marginTop],
						[this.x + marginLeft, this.y + this.h - marginTop],
						[this.x + this.w - marginRight, this.y + this.h / 2]
					], arrowStyle);
				core.setAlpha(ctx, 1);
			}
		}

		/** 切换装备面板的单个装备选框 */
		class EquipBox extends ButtonBase {
			constructor(x, y, w, h) {
				super(x, y, w, h);
				/** @type {EquipSlots} */ // @ts-ignore
				this.menu;
				this.key = -1;
			}

			draw() {
				const ctx = this.ctx;
				const [x, y, w, h] = [this.x, this.y, this.w, this.h];
				const space = 2,
					lineWidth = 2,
					squareSize = w;
				const equipId = core.getEquip(this.menu.getTotalIndex(this.key));
				if (equipId) core.drawIcon(ctx, equipId, x + 4, y + 4, squareSize - 8, squareSize - 8);
				const color = (UI.selectType === 'equipBox' && this.menu.index === this.key) ? 'gold' : 'white';
				core.strokeRect(ctx, x, y, squareSize, squareSize, color, lineWidth);
				core.setTextAlign(ctx, "center");
				core.setTextBaseline(ctx, "top");
				const tx = x + w / 2,
					ty = y + squareSize + space;
				core.fillText(ctx, this.menu.currItemList[this.key], tx, ty, color, '14px Verdana');
			}
		}

		// #endregion
		// #region 绘制用到的菜单类

		// 道具栏/装备栏的背景
		class ItemBoxBack extends MenuBase {
			constructor() {
				// 装备栏和道具栏共用同一个光标，故所有按键事件全部写在这里处理
				super('itemBoxBack', ['ondown', 'keyDown', 'keyUp'], null, null, null, null, 136);
			}

			keyDownEvent(keyCode) {
				const { type, selectType, itemInv, equipSlots } = UI;
				if (keyCode === KeyCodeEnum.Left) { // left	
					if (selectType === 'toolBox') itemInv.pageDown();
					else if (selectType === 'equipBox') {
						if (equipSlots.index === 0) {
							equipSlots.pageDown();
						} else {
							equipSlots.setIndex(equipSlots.index - 1);
						}
					}
				} else if (keyCode === KeyCodeEnum.Right) { // right		
					if (selectType === 'toolBox') itemInv.pageUp();
					else if (selectType === 'equipBox') {
						if (equipSlots.index === equipSlots.currItemList.length - 1) {
							equipSlots.pageUp();
						} else {
							equipSlots.setIndex(equipSlots.index + 1);
						}
					}
				} else if (keyCode === KeyCodeEnum.Up) { // up
					if (selectType === 'toolBox') {
						if (itemInv.index === 0) {
							if (type === 'equips') { // 在仅物品栏模式下点上键到顶，切换到上一页，否则会切换到装备栏
								equipSlots.setIndex(equipSlots.currItemList.length - 1);
							} else {
								itemInv.pageDown(); // 向上到顶将翻到上一页
							}
						} else {
							itemInv.setIndex(itemInv.index - 1);
						}
					} else if (selectType === 'equipBox') {
						if (equipSlots.index >= equipSlots.rowMax) {
							equipSlots.index -= equipSlots.rowMax;
						}
					}
				} else if (keyCode === KeyCodeEnum.Down) { // down
					if (selectType === 'toolBox') {
						if (itemInv.index < itemInv.currItemList.length - 1) {
							itemInv.setIndex(itemInv.index + 1);
						} else {
							itemInv.pageUp(); // 向下到底将翻到下一页
						}
					} else if (selectType === 'equipBox') {
						let newIndex = equipSlots.index + equipSlots.rowMax;
						if (newIndex < equipSlots.currItemList.length - 1) {
							equipSlots.setIndex(newIndex);
						} else {
							equipSlots.setIndex(0);
						}
					}
				}
			}

			keyUpEvent(keyCode, altKey) {
				const { itemId, selectType, itemInv, equipSlots: equipChangeBoard } = UI;
				if (keyCode === KeyCodeEnum.Q) { // Q
					if (UI.type === "equips") UI.exit();
					else UI.switchType();
				} else if (keyCode === KeyCodeEnum.T) { // T
					if (UI.type === "all") UI.exit();
					else UI.switchType();
				} else if (keyCode === KeyCodeEnum.BackSpace || keyCode === KeyCodeEnum.Esc) { // BackSpace/Esc
					UI.exit();
				} else if (keyCode === KeyCodeEnum.Enter || keyCode === KeyCodeEnum.SpaceBar || keyCode === KeyCodeEnum.C) { // Enter/SpaceBar/C
					if (selectType === "toolBox") {
						if (core.material.items[itemId]) itemInv.triggerItem();
					} else if (selectType === "equipBox") {
						equipChangeBoard.triggerItem();
						[UI._equipSlots, UI._equipInv, UI._itemInfo].forEach((menu) => {
							if (menu && menu.onDraw) menu.drawContent();
						});
					} else {
						itemInv.setIndex(0);
					}
				} else if (altKey && keyCode >= 48 && keyCode <= 57) { // 都有自动切装了还有神人想要这个Alt换装 服了
					core.items.quickSaveEquip(keyCode - 48);
					return;
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
				if (UI.type === 'equips') core.drawLine(ctx, 3, 140, 248, 140, 'white', 2); // 装备栏和道具栏的分界线
			}
		}

		// 物品列表和换装界面的共用基类 
		class ItemListBase extends MenuBase {
			constructor(name, x, y, w, h, zIndex) {
				super(name, ['ondown', 'onmove'], x, y, w, h, zIndex);
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
			}

			/** 
			 * @abstract 获取最新的物品列表
			 * @returns {string[]}
			 */
			getItemList() { return []; }

			/** 
			 * @virtual 
			 * @description 选中指定位置 
			 * @param {number} index 
			 **/
			setIndex(index) { }

			/** 
			 * @abstract 尝试使用当前选中的物品 
			 */
			triggerItem() { }

			/** 更新物品列表 */
			updateItemList() {
				this.allItemList = this.getItemList();
				this.pageMax = Math.ceil(this.allItemList.length / this.pageCap);
				if (this.pageMax < 1) this.pageMax = 1;
				if (this.page >= this.pageMax) this.page = this.pageMax - 1;
				this.currItemList = this.allItemList.slice(this.page * this.pageCap, (this.page + 1) * this.pageCap);
				if (this.index >= this.currItemList.length && this.currItemList.length > 0) this.setIndex(this.currItemList.length - 1);
			}

			canPageUp() {
				return this.page < this.pageMax - 1;
			}

			canPageDown() {
				return this.page > 0;
			}

			/** 翻页，更新物品列表，并重绘该菜单自身 */
			pageUp() {
				if (!this.canPageUp()) return;
				this.page++;
				this.updateItemList();
				this.setIndex(Math.min(this.index, this.currItemList.length - 1));
				this.drawContent();
			}

			/** 翻页，更新物品列表，并重绘该菜单自身 */
			pageDown() {
				if (!this.canPageDown()) return;
				this.page--;
				this.updateItemList();
				this.setIndex(this.index);
				this.drawContent();
			}
		}

		/** 展示角色当前已穿戴的装备的面板 */
		class EquipSlots extends ItemListBase {
			constructor(x, y, w, h, zIndex) {
				super('equipChangeBoard', x, y, w, h, zIndex);
				this.columnMax = 4;
				this.rowMax = 2;
				this.pageCap = this.columnMax * this.rowMax;
				this.updateItemList();
				const currNameList = this.currItemList;

				const columnCount = Math.min(currNameList.length, this.columnMax), // 判断装备孔数量是否小于最大列数
					rowCount = Math.min(Math.ceil(currNameList.length / this.columnMax), this.rowMax);
				const [boxWidth, boxHeight] = [36, 52];
				const spaceX = (this.w - columnCount * boxWidth) / (1 + columnCount),
					spaceY = (this.h - rowCount * boxHeight) / (1 + rowCount);
				let [xi, yi] = [spaceX, spaceY];

				// 装备孔的按钮在这里注册
				for (let i = 0; i < this.pageCap; i++) {
					if (!this.btnMap.has(i)) {
						const btn = new EquipBox(xi, yi, boxWidth, boxHeight);
						this.registerBtn(i, btn, {
							ondown: function () {
								if (this.index !== i) {
									this.setIndex(i);
								} else this.triggerItem(i);
							}.bind(this),
							onmove: function () {
								if (UI.isNoHover) return;
								if (this.index !== i) {
									this.setIndex(i);
								}
							}.bind(this),
						});
						if ((i >= this.currItemList.length)) btn.disable = true;
					} else {
						const btn = this.btnMap.get(i);
						if (btn) btn.disable = (i >= this.currItemList.length);
					}
					if ((i + 1) % this.columnMax === 0) {
						xi = spaceX;
						yi += spaceY + boxHeight;
					} else { xi += spaceX + boxWidth; }
				}
			}

			drawContent() {
				const ctx = this.createCanvas();
				if (this.pageMax > 1) {
					core.setTextAlign(ctx, "center");
					core.setTextBaseline(ctx, "alphabetic");
					core.fillText(ctx, this.page + 1 + '/' + this.pageMax, this.w / 2, this.h - 2, 'white', '12px Verdana');
				}
				// 切装面板只有1页时不激活翻页按钮
				if (this.allItemList.length < this.pageCap) {
					const pgDown = this.btnMap.get('pgDownBtn');
					const pgUp = this.btnMap.get('pgUpBtn');
					if (pgDown) pgDown.disable = true;
					if (pgUp) pgUp.disable = true;
				}

				super.drawContent();
			}

			/**  注意，对于装备切换面板来说，它的装备列表不是装备本身，而是角色的装备孔 */
			getItemList() {
				return core.status.globalAttribute.equipName;
			}

			/** @param {number} index 根据当前页选中的序号换算对应装备在角色装备中的总序号 */
			getTotalIndex(index) {
				if (index == null) index = this.index;
				return this.page * this.pageCap + index;
			}

			/** @param {number} index */
			changePageByTotalIndex(index) {
				const newPage = Math.floor(index / this.pageCap);
				this.page = newPage;
				this.updateItemList();
			}

			/** 脱下指定位置的装备 */
			triggerItem(index) {
				const totalIndex = this.getTotalIndex(index);
				if (core.status.hero.equipment[totalIndex]) {
					core.unloadEquip(totalIndex);
					core.status.route.push("unEquip:" + totalIndex);
					this.updateItemList();
					this.drawContent();
					UI.itemInv.updateItemList(); //穿脱装备是双向的过程，装备栏和道具栏的物品列表组成都会变
					UI.itemInv.drawContent();
					UI.itemId = '';
				}
			}

			setIndex(index) {
				this.index = index;
				UI.equipInv.index = -1;
				core.ui.clearUIEventSelector(1);
				// 被选中的装备框变色
				this.btnMap.forEach((ele, key) => {
					if (ele instanceof EquipBox) {
						if (key === index) ele.status = 'selected';
						else ele.status = 'none';
					}
				})
				UI.selectType = 'equipBox';
				const totalIndex = this.getTotalIndex(index);
				UI.itemId = core.status.hero.equipment[totalIndex];
				this.drawButtonContent();
			}

			pageUp() {
				if (!this.canPageUp()) return;
				this.page++;
				this.updateItemList();
				this.btnMap.forEach((btn, key) => {
					if (btn instanceof EquipBox) {
						if (Number(key) >= this.currItemList.length) btn.disable = true;
					}
				});
				this.setIndex(Math.min(this.index, this.currItemList.length - 1));
				this.drawContent();
			}

			pageDown() {
				if (!this.canPageDown()) return;
				this.page--;
				this.updateItemList();
				this.btnMap.forEach((btn, key) => {
					if (btn instanceof EquipBox) {
						if (Number(key) <= this.currItemList.length - 1) btn.disable = false;
					}
				});
				this.setIndex(this.index);
				this.drawContent();
			}
		}

		/** 展示角色当前背包物品的面板，有道具/装备两种模式 */
		class InventoryBase extends ItemListBase {
			/**
			 * @param {*} name 
			 * @param {string} x 
			 * @param {number} y 
			 * @param {number} w 
			 * @param {number} h 
			 * @param {number} zIndex 
			 * @param {number} pageCap 单个页面显示的物品数
			 */
			constructor(name, x, y, w, h, zIndex, pageCap) {
				super(name, x, y, w, h, zIndex);

				/** @type {number} 单个物品占据的列宽 */
				this.oneItemHeight = 30;
				/** @type {number} 单个页面显示的物品数, -1是因为最后一行要留给换行按钮*/
				this.pageCap = pageCap;
				this.marginLeft = 15; // 物品栏左边距
				this.marginTop = 40; // 物品栏上边距
				this.x0 = this.x + this.marginLeft; // 物品栏左边距
				this.y0 = this.y + this.marginTop; 
				this.w0 = this.w - this.marginLeft - 5; // 物品栏真实宽度
				this.h0 = this.oneItemHeight * (this.pageCap + 1); // +1是因为最后一行要留给翻页按钮 
			}

			drawContent() {
				const ctx = this.createCanvas();
				const { x0, y0, w0, h0, marginTop, marginLeft} = this;
				const { w, h } = this;
				core.fillRect(ctx, marginLeft, marginTop, w0, h0, 'rgb(0, 105, 148)');

				core.setTextBaseline(ctx, "middle");
				for (let i = 0; i < this.currItemList.length; i++) {
					this.drawOneItem(i);
				}
				core.setTextAlign(ctx, "center");
				core.setTextBaseline(ctx, "alphabetic");
				core.fillText(ctx, (this.page + 1) + '/' + this.pageMax, w / 2, y0 + h0 - 4, 'white', '12px Verdana');
				super.drawContent();
			}

			/** @param {number} currIndex  */
			drawOneItem(currIndex) {
				const itemId = this.currItemList[currIndex];
				const ctx = core.dymCanvas[this.name];
				const { x0, y0, marginTop } = this;
				const dy = this.oneItemHeight * currIndex + marginTop;

				const item = core.material.items[itemId] || {};
				const num = core.formatBigNumber(core.itemCount(itemId), 5) || 0; // 道具数量过大时需要format

				// 被隐藏的道具在显示时需要半透明
				const hideInfo = core.getFlag('hideInfo', {});
				if (item && (hideInfo.hasOwnProperty(itemId) ? hideInfo[itemId] : item.hideInToolbox)) core.setAlpha(ctx, 0.5);

				// 绘制物品图标
				if (core.material.items[itemId]) core.drawIcon(ctx, itemId, x0 + 4, dy + 6, 18, 18);

				core.setTextAlign(ctx, "right");
				core.setTextBaseline(ctx, "middle");
				// 绘制物品数量 ×几
				const numText = "×" + num;
				core.fillText(ctx, numText, x0 + 218, dy + this.oneItemHeight / 2, 'white', '18px Verdana');

				// 绘制物品名称
				const markedItems = core.getFlag('markedItems', []);
				const name = item.name || "???";
				core.setTextAlign(ctx, "left");
				core.fillText(ctx, name, x0 + 24, dy + this.oneItemHeight / 2, markedItems.includes(itemId) ? 'gold' : 'white', '18px Verdana', 180);
				core.setAlpha(ctx, 1);
			}

			clear() {
				core.clearUIEventSelector(1);
				super.clear();
			}

			/** 绘制选中物品的光标，在selectType或index改变时自动执行绘制/擦除
			 * @param {number} index 选中物品在当前页的序号
			 */
			drawSelector(index) {
				const [x0, y0, w0] = [this.x0, this.y0, this.w0]; // 光标绘制是绝对坐标
				core.drawUIEventSelector(1, 'winskin.png', x0, y0 + index * this.oneItemHeight, w0, this.oneItemHeight, 140);
			}

			/** 选中指定序号的位置，改变选中道具的ID，重绘光标 
			 * @param {number} index 选中物品在当前页的序号
			 */
			setIndex(index) {
				this.index = index;
				if (UI.type === 'equips') {
					UI.equipSlots.index = -1;
					UI.equipSlots.drawButtonContent(); // 清除装备栏的选中状态
					UI.selectType = 'toolBox';
				}
				this.drawSelector(index);
				UI.itemId = this.currItemList[index];
			}

			ondownEvent(_x, _y, px, py) {
				py -= this.marginTop; // 转换为相对于物品栏内部的坐标
				const index = Math.floor(py / this.oneItemHeight);
				if (index < 0 || index >= this.currItemList.length) return;
				if (UI.selectType !== 'toolBox' || this.index !== index) {
					this.setIndex(index);
				} else {
					this.triggerItem();
				}
			}

			onmoveEvent(_x, _y, px, py) {
				if (UI.isNoHover) return;
				py -= this.marginTop; // 转换为相对于物品栏内部的坐标
				const index = Math.floor(py / this.oneItemHeight);
				if (index < 0 || index >= this.currItemList.length) return;
				if (UI.selectType !== 'toolBox' || this.index !== index) {
					this.setIndex(index);
				}
			}
		}

		class ToolInventory extends InventoryBase {
			constructor(x, y, w, h, zIndex, pageCap) {
				super('toolInventory', x, y, w, h, zIndex, pageCap);
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
				const itemId = UI.itemId;
				if (!core.canUseItem(itemId) && itemId !== 'centerFly') {
					core.drawFailTip("当前无法使用" + core.material.items[itemId].name, itemId);
					return;
				}
				UI.clearAll();
				setTimeout(() => {
					core.unlockControl();
					core.tryUseItem(itemId);
				}, 0);
			}

			/** 物品栏仅显示指定类型物品 */
			classify(subType) {
				if (UI.type !== 'all') {
					// 非物品栏类型的菜单不支持分类
					return;
				}
				if (this.subType !== subType) {
					const oldConfig = this.cache[this.subType],
						newConfig = this.cache[subType];
					oldConfig.page = this.page;
					oldConfig.index = this.index;
					this.page = newConfig.page;
					this.index = newConfig.index;
					this.subType = subType;
					this.updateItemList();
					this.setIndex(this.index);
					this.drawContent();
					UI.back.drawContent(); // 切换物品栏类型时需要重绘背景
				}
			}
		}

		class EquipInventory extends InventoryBase {
			getItemList() {
				return core.getToolboxItems('equips', core.hasFlag('showHideItem'));
			}

			triggerItem() {
				const equip = UI.itemId;
				if (!core.canEquip(equip, true)) return;
				const equipPos = core.getEquipTypeById(equip);
				UI.equipSlots.changePageByTotalIndex(equipPos);
				core.loadEquip(equip);
				core.status.route.push("equip:" + equip);
				this.updateItemList(); // 穿上装备会导致道具数量变化，需要重新生成装备列表
				this.setIndex(this.index);
				this.drawContent();
				UI.equipSlots.drawContent();
			}
		}

		class ItemInfoBoard extends MenuBase {
			constructor(x, y, w, h) {
				super('itemInfoBox', ['ondown'], x, y, w, h, 137);
			}

			drawContent() {
				const ctx = this.createCanvas();
				core.strokeRoundRect(ctx, 23, 27, 32, 32, 2, 'white', 2);
				const itemId = UI.itemId;
				if (itemId) core.drawIcon(ctx, itemId, 24, 28, 30, 30);

				// 修改这里可以编辑未选中道具时的默认值
				const defaultItem = { cls: "constants", name: "无道具", id: "-", text: "没有道具最永久" };
				const defaultEquip = { cls: "equips", name: "无装备", id: "-", text: "一无所有，又何尝不是一种装备", equip: { type: "装备" } };
				let item = core.material.items[itemId];
				if (!item) item = (UI.type === 'all' ? defaultItem : defaultEquip);
				core.setTextAlign(ctx, "left");
				core.setTextBaseline(ctx, "middle");
				core.fillText(ctx, item.name, 66, 46, 'black', 'bold 18px Verdana', 98); // 物品名字 e.g.护符
				core.fillText(ctx, "类型", 20, 75, 'crimson', '14px Verdana');
				core.fillText(ctx, "【" + getItemClsName(item) + "】", 50, 75, 'rgb(47, 49, 54)', '14px Verdana'); // 物品类型 e.g.【永久道具】

				if (UI.type === 'all') { // 显示物品累计使用的次数
					core.fillText(ctx, "累计使用", 20, 95, 'crimson', '14px Verdana');
					const itemsUsedCount = core.getFlag('itemsUsedCount', {});
					core.fillText(ctx, itemsUsedCount[itemId] || 0, 80, 95, 'rgb(47, 49, 54)', '14px Verdana');
				}
				const rawItemText = core.replaceText(item.text) ?? "";
				const itemText = rawItemText + ((UI.type === "equips") ? this.getEquipCompareInfo(item) : ""); // 物品描述信息
				core.drawTextContent(ctx, itemText, {
					left: 20,
					top: 110,
					bold: false,
					color: "black",
					align: "left",
					fontSize: 15,
					maxWidth: 150
				});
				const currItemHotKey = HotkeySelect.getHotkeyNum(itemId);
				// 获取快捷键设置按钮当前的图标

				const setHotkeyBtn = /** @type {IconBtnClass} */ (this.btnMap.get('setHotkeyBtn'));
				if (setHotkeyBtn) {
					setHotkeyBtn.disable = (UI.type === 'equips');
					setHotkeyBtn.icon = (currItemHotKey == null) ? 'keyboard' : ('btn' + currItemHotKey);
				}
				super.drawContent();
			}

			/*** @param {Item} item */
			getEquipCompareInfo(item) {
				let str = '';
				if (UI.type !== "equips") return str;

				let equipType = item.equip?.type;
				if (!equipType) return str;
				if (typeof equipType == "string") equipType = core.getEquipTypeByName(equipType);
				let compare;
				/** @todo 准备卸下装备时显示卸下的比较信息 */
				if (UI.selectType == "equipBox") compare = core.compareEquipment(null, item.id);
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

		/** 取消设置快捷键的按钮 */
		class SetNullBtn extends ButtonBase {
			draw() {
				const [x, y, w, h] = [this.x, this.y, this.w, this.h];
				core.strokeRect(this.ctx, x, y, w, h, 'red', 2);
				core.drawLine(this.ctx, x, y, x + w, y + h, 'red', 2);
			}
		}

		// 为当前道具设定一个快捷键
		class HotkeySelect extends MenuBase {
			constructor(itemId, x, y, w, h, zIndex) {
				super('hotkeySelect', ['ondown', 'keyDown'], x, y, w, h, zIndex);
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
					const btn = this.btnMap.get('btn' + this.hotkeyNum);
					if (btn) {
						core.fillPolygon(ctx, [
							[btn.x + 12, btn.y + btn.h + 10],
							[btn.x + btn.w - 12, btn.y + btn.h + 10],
							[btn.x + btn.w / 2, btn.y + btn.h + 2]
						], 'black');
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
				const { back, itemInv, equipSlots, itemInfo } = UI;
				[back, itemInv, equipSlots, itemInfo].forEach(menu => {
					if (menu.onDraw) menu.beginListen(); // 注意本来就没在绘制的则不监听
				});
				UI.itemInfo.drawContent(); // 快捷键图标会发生变化
			}
		}

		/** @param {string} itemId */
		function hotkeySelectFactory(itemId) {
			const hotkeySelect = new HotkeySelect(itemId, 60, 100, 296, 206, 141); // 应当比物品背包的选择光标大，遮盖住前者
			const setHotkeyNum = function (i) {
				const num = this.key.replace('btn', '');
				hotkeySelect.setHotkey(num);
				hotkeySelect.clear();
				UI.itemInfo.drawContent();
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
				hotkeySelect.registerBtn('btn' + num, btn, () => setHotkeyNum.call(btn, i));
			}
			const setNullBtn = new SetNullBtn(leftMargin + 4 * (btnSize + btnInterval), 150, btnSize, btnSize);
			hotkeySelect.registerBtn('setNullBtn', setNullBtn, () => {
				hotkeySelect.deleteHotkey();
				hotkeySelect.clear();
				UI.itemInfo.drawContent();
			});
			const exitBtn = new ExitBtn(274, 5, 16, 16, { radius: 1, lineOffsetX: 2, lineWidthX: 2 });
			hotkeySelect.registerBtn('exitBtn', exitBtn, () => hotkeySelect.clear());
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

		function clearItemBoxCache() {
			UI._itemId = '';
			UI.selectType = 'toolBox';
			[UI._toolInv, UI._equipInv, UI._equipSlots].forEach((menu) => {
				if (menu) menu.index = 0;
			});
		} // 每次存读档，及进行录像回放时调用，清空之前选中的道具信息
		this.clearItemBoxCache = clearItemBoxCache;

		// 以下是本插件范围内的全局变量

		const UI = {
			/** 当前打开的是道具页还是装备页 
			 * @type {'all'|'equips'} 
			 **/
			type: 'all',
			/** @type {'toolBox'|'equipBox'} 当前选中了哪一个子界面（切装面板/物品栏） */
			selectType: 'toolBox',
			_itemId: '',
			/** @type {string} 当前选中的物品ID，变化时自动触发右侧栏的信息变化 */
			get itemId() {
				return this._itemId;
			},
			set itemId(value) {
				if (this._itemId !== value) {
					this._itemId = value;
					this.itemInfo.drawContent();
				}
			},
			/** @type {undefined|ItemBoxBack} 物品页面的背景 */
			_back: undefined,
			/** @type {undefined|ToolInventory} 道具背包 */
			_toolInv: undefined,
			/** @type {undefined|EquipInventory} 装备背包 */
			_equipInv: undefined,
			/** @type {undefined|ItemInfoBoard} 右侧显示选中物品详细信息的页面 */
			_itemInfo: undefined,
			/** @type {undefined|EquipSlots} 显示已穿戴装备的面板 */
			_equipSlots: undefined,
			/** 是否监听onMove事件 */
			isNoHover: core.getLocalStorage('itemBoxNoHover'),
			/** 物品页面的背景 */
			get back() {
				if (!this._back) {
					this._back = new ItemBoxBack();
					const switchModeBtn = new SwitchBtn(385, 5, 24, 24, { strokeStyle: ' #8B4513', fillStyle: ' #D2691E' });
					const exitBtn = new ExitBtn(385, 385, 24, 24);
					this._back.registerBtns([['exitBtn', exitBtn, UI.exit.bind(UI)],
					['switchModeBtn', switchModeBtn, UI.switchType.bind(UI)]]);
				}
				return this._back;
			},
			/** 道具背包 */
			get toolInv() {
				if (!this._toolInv) {
					this._toolInv = new ToolInventory(0, 0, 240, 416, 137, 11);
					const pgDown = new ArrowBtn(20, 375, 20, 20, 'left');
					const pgUp = new ArrowBtn(215, 375, 20, 20, 'right');
					this.toolInv.registerBtns([
						['pgDownBtn', pgDown, () => UI.toolInv.pageDown()],
						['pgUpBtn', pgUp, () => UI.toolInv.pageUp()]
					]);
					const allBtn = new ClassifyBtn(20, 10, 44, 24, "全部", "all"),
						toolsBtn = new ClassifyBtn(80, 10, 44, 24, "消耗", "tools"),
						constantsBtn = new ClassifyBtn(140, 10, 44, 24, "永久", "constants");
					const noHoverBtn = new NoHoverBtn(210, 10, 24, 24, null, { crossline1: this.isNoHover });
					const noHover = () => {
						UI.isNoHover = !UI.isNoHover;
						core.setLocalStorage('itemBoxNoHover', UI.isNoHover);
						noHoverBtn.config.crossline1 = UI.isNoHover;
						UI._toolInv?.drawButtonContent();
					}
					this._toolInv.registerBtns([
						['allBtn', allBtn, () => this.toolInv.classify('all')],
						['toolsBtn', toolsBtn, () => this.toolInv.classify('tools')],
						['constantsBtn', constantsBtn, () => this.toolInv.classify('constants')],
						['noHoverBtn', noHoverBtn, noHover]
					]);
					if (!core.platform.isPC) noHoverBtn.disable = true; // 非PC端本来就触发不了onmove事件，故隐藏此按钮
				}
				return this._toolInv;
			},
			/** 装备背包 */
			get equipInv() {
				if (!this._equipInv) {
					this._equipInv = new EquipInventory('equipInventory', 0, 120, 240, 416, 137, 7);
					const pgDown = new ArrowBtn(20, 255, 20, 20, 'left');
					const pgUp = new ArrowBtn(215, 255, 20, 20, 'right');;
					this._equipInv.registerBtn('pgDownBtn', pgDown, () => UI.equipInv.pageDown());
					this._equipInv.registerBtn('pgUpBtn', pgUp, () => UI.equipInv.pageUp());
				}
				return this._equipInv;
			},
			/** 物品背包 */
			get itemInv() {
				return (this.type === 'all') ? this.toolInv : this.equipInv;
			},
			/** 右侧显示选中物品详细信息的页面 */
			get itemInfo() {
				if (!this._itemInfo) {
					this._itemInfo = new ItemInfoBoard(240, 0, core.__PIXELS__ - 240, core.__PIXELS__);
					const hideBtn = new HideBtn(20, 380, 46, 24);
					this._itemInfo.registerBtn('hideBtn', hideBtn, () => {
						this.hideItem(UI.itemId);
						this.itemInv.updateItemList();
						this.itemInv.setIndex(this.itemInv.index);
						this.itemInv.drawContent();
					});
					const markBtn = new MarkBtn(80, 380, 46, 24);
					this._itemInfo.registerBtn('markBtn', markBtn, () => {
						this.markItem(UI.itemId);
						this.itemInv.updateItemList();
						this.itemInv.setIndex(this.itemInv.index);
						this.itemInv.drawContent();
					});
					const showHideBtn = new ShowHideBtn(20, 350, 95, 18);
					this._itemInfo.registerBtn('showHideBtn', showHideBtn, () => {
						this.switchShowHide();
						this.itemInv.updateItemList();
						this.itemInv.setIndex(this.itemInv.index);
						this.itemInv.drawContent();
						this.itemInfo.drawContent(); // 这里不论选中物品是否变化，itemInfo必定要重绘，因为按钮图案会变
					});
					const setHotkeyBtn = new IconBtn(145, 60, 24, 24, 'keyboard');
					this.itemInfo.registerBtn('setHotkeyBtn', setHotkeyBtn, () => {
						if (!UI.itemId) return;
						[UI._back, UI.itemInv, UI._equipSlots, UI._itemInfo].forEach((menu) => {
							if (menu) menu.endListen();
						});
						const hotkeySelect = hotkeySelectFactory(UI.itemId);
						hotkeySelect.init();
					});
				}
				return this._itemInfo;
			},
			get equipSlots() {
				if (!this._equipSlots) {
					this._equipSlots = new EquipSlots(7, 10, 240, 125, 137);
					const config = { marginLeft: 4, marginTop: 3, marginRight: 2 };
					const pgDown = new ArrowBtn(0, 56, 14, 14, 'left', config);
					const pgUp = new ArrowBtn(224, 56, 14, 14, 'right', config);
					this._equipSlots.registerBtn('pgDownBtn', pgDown, () => UI.equipSlots.pageDown());
					this._equipSlots.registerBtn('pgUpBtn', pgUp, () => UI.equipSlots.pageUp());
				}
				return this._equipSlots;
			},
			/** 清空各个菜单的绘制和监听(不包括解除锁定) */
			clearAll() {
				[this._back, this._toolInv, this._equipInv, this._itemInfo, this._equipSlots].forEach((menu) => {
					if (menu) menu.clear();
				});
				core.status.event.id = null;
			},
			initAll() {
				[UI.back, UI.itemInv, UI.itemInfo].forEach((menu) => menu.init());
				if (UI.type === 'equips') UI.equipSlots.init();
			},
			/** 解除锁定，退出道具栏/装备栏 */
			exit() {
				this.clearAll();
				setTimeout(core.unlockControl, 0);
			},
			/** 在道具栏/装备栏模式中切换 */
			switchType() {
				this.type = (this.type === 'all') ? 'equips' : 'all';
				if (this.type === 'all') {
					this.equipSlots.clear();
					this.equipInv.clear();
				} else if (this.type === 'equips') {
					this.toolInv.clear();
					this.equipSlots.init();
				}
				this.itemInv.updateItemList();
				this.back.drawContent();
				this.itemInv.init();
				if (this.type === 'all') {
					this.itemInv.setIndex(this.itemInv.index);
				}
				else if (this.type === 'equips') {
					if (UI.selectType === 'toolBox') {
						this.itemInv.setIndex(this.itemInv.index);
					}
					else {
						this.equipSlots.setIndex(this.equipSlots.index);
					}
				}
			},
			/** 隐藏 | 取消隐藏当前选中的物品 */
			hideItem(itemId) {
				if (!itemId) return;
				let hideInfo = core.getFlag('hideInfo', {});
				if (hideInfo.hasOwnProperty(itemId)) {
					hideInfo[itemId] = !hideInfo[itemId];
				} else {
					hideInfo[itemId] = !core.material.items[itemId].hideInToolbox;
				}
				core.setFlag('hideInfo', hideInfo);
			},
			/** 置顶 | 取消置顶当前选中的物品 */
			markItem(itemId) {
				let markedItems = core.getFlag('markedItems', []);
				if (markedItems.includes(itemId)) markedItems = markedItems.filter((currId) => currId !== itemId);
				else markedItems.push(itemId);
				core.setFlag('markedItems', markedItems);
			},
			/** 切入/切出显示已隐藏物品的模式 */
			switchShowHide() {
				core.setFlag('showHideItem', !core.getFlag('showHideItem', false));
			}
		}

		// 程序入口，在_drawToolbox 与 _drawEquipbox处调用
		/** @param {'all'|'equips'} currType  */
		function drawItemBox(currType) {
			UI.clearAll();
			if (UI._toolInv && UI._toolInv?.onDraw && currType === UI.type) return;
			core.lockControl();
			UI.type = currType;
			UI.itemInv.updateItemList();
			UI.itemInv.setIndex(UI.itemInv.index);
			UI.initAll();
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
							for (let k = 0, l = equipOwned[j]; k < l; k++) {
								equipList[equipIncluded.indexOf(equipType)].add(j);
							}
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
				vertical: ['play', 'stop', 'rewind', 'book', 'view', 'speedDown', 'speedUp', 'save'],
				horizontal: ['play', 'stop', 'rewind', 'speedDown', 'speedUp', 'save']
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
			if (type === 'replay' &&
				(['fly', 'shop', 'load', 'settings', 'btnAlt', 'rollback', 'undoRollback', 'btnAlt'].includes(value))) {
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

		// #region 复写
		// 复写resize，保证屏幕变化时此画布表现正常 
		const originResize = core.control.resize;
		core.control.resize = function () {
			originResize.apply(core.control, arguments);
			/** @type {SettingBack} */
			const settingMenu = core.plugin.settingMenu;
			if (settingMenu && settingMenu.onDraw) {
				settingMenu.drawContent();
				settingMenu.pageList[settingMenu.currPage].drawContent();
			}
		}
		// #endregion

		/**
		 * @typedef {{
		 * getName:()=>string,
		 * effect:()=>void,
		 * text:string,
		 * replay?:boolean,
		 * draw?:((ctx:string)=>void)
		 * }} Setting
		 */
		function invertFlag(name) {
			core.setFlag(name, !core.hasFlag(name));
		}

		function invertLocalStorage(name) {
			const value = core.getLocalStorage(name, false);
			core.setLocalStorage(name, !value);
		}

		// #endregion 
		// #region 设置的具体内容，与相应的录像注册
		// #endregion
		// #region 按钮类

		const { ButtonBase, RoundBtn, IconBtn, ExitBtn,
			ArrowBtn, MenuBase, Pagination, KeyCodeEnum } = core.plugin.uiBase;

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
		// #endregion
		// #region 菜单类

		// #region 单个设置菜单的基类
		/** 单个设置按钮的基类 */
		class SettingButton extends ButtonBase {
			constructor(x, y, w, h, ...drawArgs) {
				super(x, y, w, h);
				/** @type {Setting} 将在registerBtn时赋予此项 */ // @ts-ignore
				this.setting;
				this.drawArgs = drawArgs;
			}

			draw() {
				const ctx = this.ctx;
				const [x, y, w, h] = [this.x, this.y, this.w, this.h];
				const setting = this.setting;
				// 取消注释下面这一句将显示所有按钮的判定框
				// core.strokeRect(ctx, this.x, this.y, this.w, this.h, 'yellow');
				core.setTextAlign(ctx, 'start');
				core.ui.fillText(ctx, setting.getName(), x, y + h / 2 + 5, 'white', '16px Verdana');
				const drawFunc = setting.draw;
				if (this.status === 'selected') {
					core.drawUIEventSelector(0, "winskin.png", this.x, this.y, this.w, this.h, 137);
				}
				if (drawFunc) drawFunc.apply(this, [ctx, ...this.drawArgs]);
			}
		}

		// @todo 悬浮按钮不改变时不触发事件 这个优化有没有做

		/** 单个设置菜单的基类 */
		class SettingOnePage extends MenuBase {
			constructor(name, settingData) {
				super(name, ['ondown', 'onmove', 'keyDown']);
				this.text = '';
				/** @type {string | undefined}*/
				this.selectedPos;
				/** @type {SettingButton | undefined}*/
				this.selectedBtn;
				/** @type {{[x:string]:Setting}}*/
				this.settingData = settingData;
			}

			keyDownEvent(keyCode) {
				let x, y;
				const changePos = (newPos) => {
					if (this.btnMap.has(newPos)) {
						const button = this.btnMap.get(newPos);
						this.focus(button, newPos);
					}
				}
				if ([KeyCodeEnum.Left, KeyCodeEnum.Right, KeyCodeEnum.Up, KeyCodeEnum.Down].includes(keyCode)) {
					if (!this.selectedBtn || !this.selectedPos) {
						const button = this.btnMap.get('1,1');
						if (button) this.focus(button, '1,1');
						return;
					} else {
						[x, y] = this.selectedPos.split(',').map((x) => parseInt(x));
						if (keyCode === KeyCodeEnum.Left) x--;
						if (keyCode === KeyCodeEnum.Up) y--;
						if (keyCode === KeyCodeEnum.Right) x++;
						if (keyCode === KeyCodeEnum.Down) y++;
						let newPos = x + ',' + y;

						// 逻辑：左右，查找不到对应坐标就不动。
						// 上下，查找不到对应坐标，只要该列存在第一个元素，就会移到该列。

						if (keyCode === KeyCodeEnum.Left || keyCode === KeyCodeEnum.Right) {
							changePos(newPos);
						}
						if (keyCode === KeyCodeEnum.Up || keyCode === KeyCodeEnum.Down) {
							if (this.btnMap.has(newPos)) {
								const button = this.btnMap.get(newPos);
								this.focus(button, newPos);
							} else {
								newPos = '1,' + y;
								changePos(newPos);
							}
						}
					}
				} else {
					switch (keyCode) {
						case KeyCodeEnum.Enter: // Enter/Space
						case KeyCodeEnum.SpaceBar:
							if (this.selectedBtn) this.selectedBtn.ondown(-1, -1, -1, -1);
							break;
					}
				}
			}

			/** 
			 * @param {SettingButton} btn  
			 * @param {string} key 对应事件的索引
			 **/
			execEffect(btn, key, ...eventArgs) {
				const setting = btn.setting;
				setting.effect.apply(this, eventArgs);
				if (setting.replay) {
					let actionString = 'cSet:' + key;
					if (eventArgs && eventArgs.length > 0) {
						actionString += ':' + eventArgs.map(arg => encodeURIComponent(arg)).join(':');
					}
					core.status.route.push(actionString);
				}
				this.drawContent();
			}

			/** 聚焦到指定的按钮并重绘菜单 */
			focus(button, pos) {
				if (this.selectedBtn === button) return; // 如果当前按钮已被选中，则不做任何操作
				this.selectedPos = pos;
				this.selectedBtn = button;
				this.btnMap.forEach((currBtn) => {
					currBtn.status = (currBtn === button) ? 'selected' : 'none';
				});
				if (button instanceof SettingButton) {
					this.text = button.setting.text || '';
				}
				this.drawContent();
			}

			drawContent(ctx) {
				if (!ctx) ctx = this.name;
				super.drawContent();
				if (this.text && this.text.length > 0) {
					core.ui.drawTextContent(ctx, this.text, {
						left: 30,
						top: 78,
						bold: false,
						color: "white",
						align: "left",
						fontSize: 14,
						maxWidth: 350
					});
				}
			}

			clear() {
				core.clearUIEventSelector(0); // 光标的绘制在按钮中进行
				super.clear();
			}

			/**
			 * @override
			 * @param {string} pos 
			 * @param {string} key
			 * @param {SettingButton} btn 
			 * @param {...(string|number)} eventArgs
			 */
			registerSettingBtn(pos, key, btn, ...eventArgs) {
				super.registerBtn(pos, btn, {
					'ondown': () => {
						if (this.selectedBtn === btn) this.execEffect(btn, key, ...eventArgs);
						else this.focus(btn, pos);
					},
					'onmove': () => {
						this.focus(btn, pos);
					}
				});
				btn.setting = this.settingData[key];
			}

			registerSettingBtns(arr) {
				arr.forEach(ele => {
					const [key, btn, event, ...eventArgs] = ele;
					this.registerSettingBtn(key, btn, event, ...eventArgs);
				});
			}
		}
		// #endregion

		// #region 功能菜单
		function checkSkipFuncs() {
			const skipText = core.getLocalStorage('skipText');
			// 此函数用于检测是否处在录像模式下，是则将跳过所有非必要对话
			core.events.__action_checkReplaying = skipText ? function () {
				core.doAction();
				return true;
			}.bind(core.events) : events.prototype.__action_checkReplaying;

			const skipPeform = core.getLocalStorage('skipPeform');

			const instantMove = function (fromX, fromY, aimX, aimY, keep, callback) {
				const [_block, blockInfo] = core.maps._getAndRemoveBlock(fromX, fromY);
				if (keep) {
					core.setBlock(blockInfo.number, aimX, aimY);
					core.showBlock(aimX, aimY);
				}
				if (callback) callback();
			}

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
		/** @type {{[x:string]:Setting}} */
		const gamePlaySetting = {
			autoGet: {
				getName: () => '自动拾取:' + (core.getFlag('autoGet', false) ? '开' : '关'),
				effect: () => invertFlag('autoGet'),
				text: '每走一步，自动拾取当前层可获得的道具。',
				replay: true,
			},
			autoBattle: {
				getName: () => '自动清怪:' + (core.getFlag('autoBattle', false) ? '开' : '关'),
				effect: () => invertFlag('autoBattle'),
				text: '每走一步，自动和当前层可到达位置伤害为0的敌人战斗。对部分特殊敌人无效。',
				replay: true,
			},
			noRouting_HP: {
				getName: () => '',
				effect: () => invertFlag('noRouting_HP'),
				text: '自动寻路时绕过加血物品。同时自动拾取也将忽略这类物品。',
				replay: true,
				/** @this {SettingButton} */
				draw: function (ctx) {
					core.setAlpha(ctx, core.hasFlag('noRouting_HP') ? 1 : 0.3);
					core.drawIcon(ctx, 'redPotion', this.x, this.y, this.w, this.h);
					core.setAlpha(ctx, 1);
				}
			},
			noRouting_MDEF: {
				getName: () => '',
				effect: () => invertFlag('noRouting_MDEF'),
				text: '自动寻路时绕过加护盾物品。同时自动拾取也将忽略这类物品。',
				replay: true,
				/** @this {SettingButton} */
				draw: function (ctx) {
					core.setAlpha(ctx, core.hasFlag('noRouting_MDEF') ? 1 : 0.3);
					core.drawIcon(ctx, 'greenGem', this.x, this.y, this.w, this.h);
					core.setAlpha(ctx, 1);
				}
			},
			noRouting_ATK: {
				getName: () => '',
				effect: () => invertFlag('noRouting_ATK'),
				text: '自动寻路时绕过加攻物品。同时自动拾取也将忽略这类物品。',
				replay: true,
				/** @this {SettingButton} */
				draw: function (ctx) {
					core.setAlpha(ctx, core.hasFlag('noRouting_ATK') ? 1 : 0.3);
					core.drawIcon(ctx, 'redGem', this.x, this.y, this.w, this.h);
					core.setAlpha(ctx, 1);
				}
			},
			noRouting_DEF: {
				getName: () => '',
				effect: () => invertFlag('noRouting_DEF'),
				text: '自动寻路时绕过加防物品。同时自动拾取也将忽略这类物品。',
				replay: true,
				/** @this {SettingButton} */
				draw: function (ctx) {
					core.setAlpha(ctx, core.hasFlag('noRouting_DEF') ? 1 : 0.3);
					core.drawIcon(ctx, 'blueGem', this.x, this.y, this.w, this.h);
					core.setAlpha(ctx, 1);
				}
			},
			clickMove: {
				getName: () => '单击瞬移:' + (core.hasFlag('__noClickMove__') ? '关' : '开'),
				effect: () => invertFlag('__noClickMove__'),
				text: '系统设置。单击即可触发瞬移。',
				replay: true,
			},
			moveSpeedDown: {
				getName: () => ' < 步时:' + core.values.moveSpeed,
				effect: () => core.actions._clickSwitchs_action_moveSpeed(-10),
				text: '缩短步时。',
				replay: false, // 录像中不可录入任何DOM操作
			},
			moveSpeedUp: {
				getName: () => ' > ',
				effect: () => core.actions._clickSwitchs_action_moveSpeed(10),
				text: '增大步时。',
				replay: false,
			},
			floorChangeTimeDown: {
				getName: () => ' <   转场:' + core.values.floorChangeTime,
				effect: () => core.actions._clickSwitchs_action_floorChangeTime(-100),
				text: '缩短转场时间。',
				replay: false, // 录像中不可录入任何DOM操作
			},
			floorChangeTimeUp: {
				getName: () => ' > ',
				effect: () => core.actions._clickSwitchs_action_floorChangeTime(100),
				text: '增大转场时间。',
				replay: false,
			},
			skipText: {
				getName: () => '跳过剧情:' + (core.getLocalStorage('skipText', false) ? '开' : '关'),
				effect: () => {
					invertLocalStorage('skipText');
					checkSkipFuncs();
				},
				text: '跳过全部文字对话。初见请勿开启此选项。',
				replay: false,
			},
			skipPeform: {
				getName: () => '跳过演出:' + (core.getLocalStorage('skipPerform', false) ? '开' : '关'),
				effect: () => {
					invertLocalStorage('skipPerform');
					checkSkipFuncs();
				},
				text: '加速等待、播放动画等常见演出效果。',
				replay: false,
			},
			comment: {
				getName: () => '在线留言:' + (core.hasFlag('comment') ? '开' : '关'),
				effect: () => {
					if (core.hasFlag('comment')) {
						core.setFlag('comment', false);
						core.plugin.clearCommentSign();
					} else {
						core.setFlag('comment', true);
						core.plugin.drawCommentSign();
					}
				},
				text: '在地图上显示玩家的在线留言。',
				replay: true,
			},
			autoHideFloor: {
				getName: () => '自动隐藏楼层:' + (core.hasFlag('autoHideFloor') ? '开' : '关'),
				effect: () => {
					invertFlag('autoHideFloor');
				},
				text: '一个楼层已无物品、敌人、NPC(不含已忽略图块)，且无未到达楼层传送口时可被自动隐藏，仅在首次进入此状态时在楼传界面触发。',
				replay: true,
			},
			autoSaveBeforeUseItem: {
				getName: () => '使用物品自动保存:' + (core.getLocalStorage('autoSaveBeforeUseItem') ? '开' : '关'),
				effect: () => {
					invertLocalStorage('autoSaveBeforeUseItem');
				},
				text: '使用消耗类物品(含破炸飞跳)前，以及即将走入滑冰、触发捕捉时自动存档。',
				replay: false,
			},
			autoSaveBeforePickItem: {
				getName: () => '拾取物品自动保存:' + (core.getLocalStorage('autoSaveBeforePickItem') ? '开' : '关'),
				effect: () => {	
					invertLocalStorage('autoSaveBeforePickItem');
				},
				text: '拾取地上物品前自动存档。',
				replay: false,
			},
		}

		class GamePlay extends SettingOnePage {
			constructor() {
				super('gamePlay', gamePlaySetting);
			}

			drawContent() {
				const ctx = this.createCanvas();
				core.fillText(ctx, '-- 自动 --', 40, 175, ' #FFE4B5', '18px Verdana');
				core.fillText(ctx, '-- 瞬移 --', 40, 225, ' #FFE4B5', '18px Verdana');
				core.fillText(ctx, '绕开', 220, 250, 'white', '16px Verdana');
				core.fillText(ctx, '-- 杂项 --', 40, 275, ' #FFE4B5', '18px Verdana');
				super.drawContent(ctx);
			}
		}

		function gamePlayFactory() {
			const gamePlayMenu = new GamePlay();
			gamePlayMenu.registerSettingBtns([
				['1,1', 'autoGet', new SettingButton(40, 180, 150, 30)],
				['2,1', 'autoBattle', new SettingButton(220, 180, 150, 30)],
				['1,2', 'clickMove', new SettingButton(40, 230, 150, 30)],
				['2,2', 'noRouting_HP', new SettingButton(260, 234, 24, 24)],
				['3,2', 'noRouting_MDEF', new SettingButton(290, 234, 24, 24)],
				['4,2', 'noRouting_ATK', new SettingButton(320, 234, 24, 24)],
				['5,2', 'noRouting_DEF', new SettingButton(350, 234, 24, 24)],
				['1,3', 'moveSpeedDown', new SettingButton(40, 280, 25, 25)],
				['2,3', 'moveSpeedUp', new SettingButton(140, 280, 25, 25)],
				['3,3', 'floorChangeTimeDown', new SettingButton(220, 280, 25, 25)],
				['4,3', 'floorChangeTimeUp', new SettingButton(340, 280, 25, 25)],
				['1,4', 'skipText', new SettingButton(40, 305, 150, 25)],
				['2,4', 'skipPeform', new SettingButton(220, 305, 150, 25)],
				['1,5', 'comment', new SettingButton(40, 330, 150, 25)],
				['2,5', 'autoHideFloor', new SettingButton(220, 330, 150, 25)],
				['1,6', 'autoSaveBeforeUseItem', new SettingButton(40, 355, 150, 25)],
				['2,6', 'autoSaveBeforePickItem', new SettingButton(220, 355, 150, 25)],
			]);
			return gamePlayMenu;
		}
		// #endregion
		// #region 视图菜单
		/** @type {{[x:string]:Setting}} */
		const gameViewSetting = {
			itemDetail: {
				getName: () => '物品显示数据:' + (core.hasFlag('itemDetail') ? '开' : '关'),
				effect: () => {
					invertFlag('itemDetail');
					core.control.updateStatusBar(); // 更新地图上物品的属性显示
				},
				text: '在地图上显示即捡即用道具和装备增加的属性值。',
				replay: true,
			},
			zoomIn: {
				getName: () => ' <  放缩:' + Math.max(core.domStyle.scale, 1) + 'x',
				effect: () => core.actions._clickSwitchs_display_setSize(-1),
				text: '放缩',
				replay: false,
			},
			zoomOut: {
				getName: () => ' > ',
				effect: () => core.actions._clickSwitchs_display_setSize(1),
				text: '放缩。',
				replay: false,
			},
			HDCanvas: {
				getName: () => '高清画面:' + (core.flags.enableHDCanvas ? '开' : '关'),
				effect: core.actions._clickSwitchs_display_enableHDCanvas,
				text: '高清画面。本功能开关后刷新游戏才能看到效果。',
				replay: false,
			},
			enableEnemyPoint: {
				getName: () => '定点怪显:' + (core.flags.enableEnemyPoint ? '开' : '关'),
				effect: core.actions._clickSwitchs_display_enableEnemyPoint,
				text: '怪物属性定点显示功能，即属性不同的怪物会在怪物手册单列。',
				replay: false,
			},
			displayEnemyDamage: {
				getName: () => '怪物显伤:' + (core.flags.displayEnemyDamage ? '开' : '关'),
				effect: core.actions._clickSwitchs_display_enemyDamage,
				text: '地图上显示怪物的伤害。',
				replay: false,
			},
			displayCritical: {
				getName: () => '临界显伤:' + (core.flags.displayCritical ? '开' : '关'),
				effect: core.actions._clickSwitchs_display_critical,
				text: '地图上显示怪物的临界值',
				replay: false,
			},
			displayExtraDamage: {
				getName: () => '领域显伤:' + (core.flags.displayExtraDamage ? '开' : '关'),
				effect: core.actions._clickSwitchs_display_extraDamage,
				text: '领域显伤',
				replay: false,
			},
			extraDamageType: {
				getName: () => '领域模式:' + (core.flags.extraDamageType == 2 ? '[最简]' : core.flags.extraDamageType == 1 ? '[半透明]' : '[完整]'),
				effect: core.actions._clickSwitchs_display_extraDamageType,
				text: '是否显示不可通行地块的领域伤害。',
				replay: false,
			},
			autoScale: {
				getName: () => '自动放缩:' + (core.getLocalStorage('autoScale') ? '开' : '关'),
				effect: () => {
					core.setLocalStorage('autoScale', !core.getLocalStorage('autoScale'));
				},
				text: '自动放缩。',
				replay: false,
			},
			bgm: {
				getName: () => '音乐:' + (core.musicStatus.bgmStatus ? '开' : '关'),
				effect: core.actions._clickSwitchs_sounds_bgm,
				text: '播放背景音乐。',
				replay: false,
			},
			se: {
				getName: () => '音效:' + (core.musicStatus.soundStatus ? '开' : '关'),
				effect: core.actions._clickSwitchs_sounds_se,
				text: '播放音效。',
				replay: false,
			},
			decreaseVolume: {
				getName: () => " <   音量:" + Math.round(Math.sqrt(100 * core.musicStatus.userVolume)),
				effect: () => core.actions._clickSwitchs_sounds_userVolume(-1),
				text: '减小音量。',
				replay: false,
			},
			increaseVolume: {
				getName: () => ' > ',
				effect: () => core.actions._clickSwitchs_sounds_userVolume(1),
				text: '增大音量。',
				replay: false,
			},
		};

		class GameView extends SettingOnePage {
			constructor() {
				super('gameView', gameViewSetting);
			}

			drawContent() {
				const ctx = this.createCanvas();
				core.fillText(ctx, '-- 显示 --', 40, 175, ' #FFE4B5', '18px Verdana');
				core.fillText(ctx, '-- 音效 --', 40, 320, ' #FFE4B5', '18px Verdana');
				super.drawContent(ctx);
			}
		}

		function gameViewFactory() {
			const gameViewMenu = new GameView();
			const advanceDisplayBtn = new RoundBtn(300, 280, 32, 18, "高级", {
				font: '12px Verdana', fillStyle: "SlateGray", radius: 1, fontStyle: "yellow",
				strokeStyle: "black"
			});
			gameViewMenu.registerBtn('openAdvanceDisplay', advanceDisplayBtn, () => {
				const settingMenu = core.plugin.settingMenu;
				if (settingMenu) {
					settingMenu.endListen();
					// 隐藏大菜单的按钮是为了避免视觉上的干扰
					settingMenu.btnMap.forEach(btn => { btn.disable = true });
					settingMenu.pageList[settingMenu.currPage].endListen();
					settingMenu.drawContent();
				}
				core.ui.clearUIEventSelector(0);
				const advanceDisplayMenu = advanceDisplayFactory();
				advanceDisplayMenu.init();
			});
			gameViewMenu.registerSettingBtns([
				['1,1', 'itemDetail', new SettingButton(40, 180, 150, 25)],
				['1,2', 'displayEnemyDamage', new SettingButton(40, 205, 150, 25)],
				['1,3', 'displayExtraDamage', new SettingButton(40, 230, 150, 25)],
				['1,4', 'autoScale', new SettingButton(40, 255, 150, 25)],
				['1,5', 'HDCanvas', new SettingButton(40, 280, 150, 25)],
				['1,6', 'bgm', new SettingButton(40, 325, 150, 25)],
				['1,7', 'decreaseVolume', new SettingButton(40, 350, 25, 25)],
				['2,7', 'increaseVolume', new SettingButton(140, 350, 25, 25)],
				['2,1', 'displayEnemyDamage', new SettingButton(220, 180, 150, 25)],
				['2,2', 'displayCritical', new SettingButton(220, 205, 150, 25)],
				['2,3', 'extraDamageType', new SettingButton(220, 230, 150, 25)],
				['2,4', 'zoomIn', new SettingButton(220, 255, 25, 25)],
				['3,4', 'zoomOut', new SettingButton(330, 255, 25, 25)],
				['2,6', 'se', new SettingButton(220, 325, 150, 25)],
			]);
			return gameViewMenu;
		}
		// #endregion
		// #region 快捷键菜单
		/** @type {{[x:string]:Setting}} */
		const keySetting = {
			leftHand: {
				getName: () => '左手模式:' + (core.flags.leftHandPrefer ? '开' : '关'),
				effect: () => {
					core.flags.leftHandPrefer = !core.flags.leftHandPrefer;
					core.setLocalStorage('leftHandPrefer', core.flags.leftHandPrefer);
				},
				text: '系统设置。左手模式下WASD将用于移动角色，IJKL对应于原始的WASD进行存读档等操作。',
				replay: true,
			},
			setHotKey: {
				getName: () => '',
				effect: /** @this {GameView} */ function (num) {
					core.utils.myprompt('输入物品名。名称（例如：破墙镐）或英文ID（例如：pickaxe）均可。', '', (value) => {
						const itemInfo = core.material.items;
						const aimItem = Object.values(itemInfo).find((item) => item.name === value || item.id === value);
						if (aimItem) {
							if (['constants', 'tools'].includes(aimItem.cls)) {
								for (let i = 1; i <= 9; i++) {
									if (i !== num && core.getLocalStorage('hotkey' + i) === aimItem.id) {
										core.setLocalStorage('hotkey' + i, null);
									}
								}
								core.setLocalStorage('hotkey' + num, aimItem.id);
								this.drawContent();
							} else {
								core.drawFailTip('错误：该类型的物品不支持快捷使用!');
							}
						} else {
							core.drawFailTip('错误：找不到该名称的物品!');
						}
					}, () => { });
				},
				text: '给选定的数字键绑定一个可快捷使用的物品。',
				replay: false,
				draw: /** @this {SettingButton} */ function (ctx, num) {
					const item = core.getLocalStorage('hotkey' + num, null);
					let icon, itemName;
					if (item && core.material.items.hasOwnProperty(item)) {
						icon = item;
						itemName = core.material.items[item].name;
					} else {
						const itemMap = {
							'1': { icon: 'pickaxe', itemName: '破墙镐' },
							'2': { icon: 'bomb', itemName: '炸弹' },
							'3': { icon: 'centerFly', itemName: '中心飞' },
							'4': { itemName: '杂物' },
							'5': { itemName: '回退一步' },
							'6': { itemName: '撤销回退' },
							'7': { itemName: '轻按' }
						};
						if (num >= 1 && num <= 9) {
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
			},
			clearHotKeys: {
				getName: () => '',
				effect: /** @this {GameView} */ function () {
					for (let i = 1; i <= 9; i++) {
						core.setLocalStorage('hotkey' + i, null);
					}
					this.drawContent();
					core.drawSuccessTip('快捷键已重置到默认状态。');
				},
				text: '重置本页面所有快捷键到默认状态。',
				replay: false,
				draw: /** @this {SettingButton} */ function (ctx) {
					core.fillRoundRect(ctx, this.x, this.y, this.w, this.h, 3, '#D3D3D3');
					core.strokeRoundRect(ctx, this.x, this.y, this.w, this.h, 3, '#888888');
					core.fillText(ctx, '重置', this.x + 5, this.y + this.h / 2 + 5, '#333333', '16px Verdana');
				}
			}
		};
		class KeyMenu extends SettingOnePage {
			constructor() {
				super('key', keySetting);
			}

			drawContent() {
				const ctx = this.createCanvas();
				core.fillText(ctx, '-- 快捷键 --', 40, 205, ' #FFE4B5', '18px Verdana');
				core.fillText(ctx, "注意⚠️更推荐在背包", 160, 190, "rgb(255,255,51)", '12px Verdana');
				core.fillText(ctx, "中点击右上角", 287, 190, "rgb(255,255,51)", '12px Verdana');
				core.fillText(ctx, "图标设置单物品的快捷键", 160, 210, "rgb(255,255,51)", '12px Verdana');
				core.drawIcon(ctx, "toolbox", 272, 178, 16, 16);
				core.drawIcon(ctx, "keyboard", 359, 178, 16, 16);
				super.drawContent(ctx);
			}
		}

		function keyMenuFactory() {
			const keyMenu = new KeyMenu();
			keyMenu.registerSettingBtns([
				['1,1', 'leftHand', new SettingButton(40, 160, 150, 25)],
				['1,2', 'setHotKey', new SettingButton(40, 220, 150, 25, '1'), 1],
				['2,2', 'setHotKey', new SettingButton(220, 220, 150, 25, '2'), 2],
				['1,3', 'setHotKey', new SettingButton(40, 250, 150, 25, '3'), 3],
				['2,3', 'setHotKey', new SettingButton(220, 250, 150, 25, '4'), 4],
				['1,4', 'setHotKey', new SettingButton(40, 280, 150, 25, '5'), 5],
				['2,4', 'setHotKey', new SettingButton(220, 280, 150, 25, '6'), 6],
				['1,5', 'setHotKey', new SettingButton(40, 310, 150, 25, '7'), 7],
				['1,6', 'clearHotKeys', new SettingButton(300, 350, 42, 25)],
			]);
			return keyMenu;
		}
		// #endregion
		// #region 自定义工具栏界面
		/** 自定义工具栏界面 */
		class ToolBtn extends ButtonBase {
			constructor(x, y, w, h, icon, text, config) {
				super(x, y, w, h);
				/** @type {ToolBarConfigPage} */ // @ts-ignore
				this.menu;
				this.icon = icon; // 特殊icon:delete 用于删除图标
				/** @todo 这里需要重构 */
				this.text = text;
				this.config = config || {};
				this.ondown = () => {
					this.menu.selectedTool = this.icon;
					this.menu.text = this.text;
					this.menu.drawContent();
				};
			}

			draw() {
				const ctx = this.ctx;
				const { strokeStyle = 'white', fillStyle = 'white', selectedStyle = 'gold' } = this.config;
				core.strokeRoundRect(ctx, this.x, this.y, this.w, this.h, 3, (this.menu.selectedTool === this.icon) ? selectedStyle : strokeStyle);
				if (this.icon === 'delete') {
					core.drawLine(ctx, this.x + 2, this.y + 2, this.x + this.w - 2, this.y + this.h - 2, 'red', 2);
					core.drawLine(ctx, this.x + 2, this.y + this.h - 2, this.x + this.w - 2, this.y + 2, 'red', 2);
				} else core.drawIcon(ctx, this.icon, this.x, this.y, this.w, this.h);
			}
		}

		class ToolBarBtn extends ButtonBase {
			constructor(x, y, size, type, length, text) {
				super(x, y, length * size, size);
				/** @type {ToolBarConfigPage} */ // @ts-ignore
				this.menu;
				this.type = type;
				this.length = length;
				/** @todo 这里需要重构 */
				this.text = text;
				this.ondown = (x, y, px, py) => {
					const squareSize = this.h;
					const index = Math.floor((px - this.x) / squareSize);
					this.menu.type = type;
					this.menu.index = index;
					this.menu.drawContent();
				}
			}

			draw() {
				const ctx = this.ctx;
				const squareSize = this.h;
				const type = this.type;
				const toolBarConfig = core.plugin.getToolBarConfig(type);
				for (let i = 0; i < this.length; i++) {
					const style = (this.menu.type === type && this.menu.index === i) ? 'gold' : 'white';
					core.strokeRoundRect(ctx, this.x + squareSize * i + i, this.y, squareSize, squareSize, 3, style);
					core.drawIcon(ctx, toolBarConfig[i], this.x + squareSize * i + i, this.y, squareSize, squareSize);
				}
			}
		}

		class ToolBarConfigPage extends MenuBase {
			constructor() {
				super('toolBarConfig', ['ondown']);
				/** 当前选中的图标 */
				this.selectedTool = 'none';
				/** 当前选中了哪个类型的工具栏 */
				this.type = 'none';
				/** 当前选中工具栏哪个位置(1-9) */
				this.index = -1;
				this.text = '';
			}

			drawContent() {
				const ctx = this.createCanvas();
				core.setTextAlign(ctx, 'left');
				core.fillText(ctx, '常规', 40, 175, ' #FFE4B5', '16px Verdana');
				core.fillText(ctx, '数字', 40, 205, ' #FFE4B5', '16px Verdana');
				core.fillText(ctx, '录像', 40, 235, ' #FFE4B5', '16px Verdana');
				core.fillText(ctx, '可选按钮', 40, 265, ' #FFE4B5', '16px Verdana');
				if (this.text && this.text.length > 0) {
					core.ui.drawTextContent(ctx, this.text, {
						left: 30,
						top: 78,
						bold: false,
						color: "white",
						align: "left",
						fontSize: 14,
						maxWidth: 350
					});
				}
				super.drawContent();
			}

			setToolBarConfig() {
				core.setToolBarConfig(this.type, this.index, this.selectedTool);
				this.drawContent();
			}
		}

		function toolBarConfigFactory() {
			// 名字不能叫toolBar 画布toolBar被系统占了
			const toolBarMenu = new ToolBarConfigPage();
			const changeToolBarBtn = new RoundBtn(320, 158, 42, 24, '执行', -1);
			changeToolBarBtn.ondown = function () {
				core.setToolBarConfig(this.menu.type, this.menu.index, this.menu.selectedTool);
				this.menu.drawContent();
			}.bind(changeToolBarBtn);
			toolBarMenu.registerBtns([
				['1,1', new ToolBarBtn(80, 158, 24, 'normal', 9, '常规模式下显示在工具栏中的图标。')],
				['1,2', changeToolBarBtn, () => toolBarMenu.setToolBarConfig()],
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
			]);
			return toolBarMenu;
		}
		// #endregion
		// #region 控制台界面
		/** @type {{[x:string]:Setting}} */
		const consoleSetting = {
			debug_wallHacking: {
				getName: () => ' 穿墙:' + (core.hasFlag('debug_wallHacking') ? '开' : '关'),
				effect: () => {
					core.setFlag('debug', true);
					invertFlag('debug_wallHacking');
				},
				text: '开启时将始终穿墙并无视各种事件，无论是否按下Ctrl。',
				replay: false,
			},
			debug_statusName: {
				getName: () => core.getFlag('debug_statusName', '??'),
				/** @this {ConsoleMenu} */
				effect: function () {
					const dictionary = {
						'体力': 'hp',
						'血量': 'hp',
						'生命': 'hp',
						'血': 'hp',
						'体力上限': 'hpmax',
						'血量上限': 'hpmax',
						'生命上限': 'hpmax',
						'血限': 'hpmax',
						'攻击': 'atk',
						'攻': 'atk',
						'防御': 'def',
						'防': 'def',
						'魔防': 'mdef',
						'护盾': 'mdef',
						'mf': 'mdef',
						'金币': 'money',
						'金钱': 'money',
						'钱': 'money',
						'经验': 'exp',
						'魔力': 'mana',
						'魔': 'mana',
						'蓝': 'mana',
					};
					core.utils.myprompt('输入要修改的属性名称', '', (value) => {
						const heroStatus = core.status.hero;
						if (dictionary.hasOwnProperty(value)) {
							value = dictionary[value];
						}
						if (heroStatus && heroStatus.hasOwnProperty(value) && ['hp', 'hpmax', 'atk', 'def', 'mdef', 'money', 'exp', 'mana', 'manamax'].includes(value)) {
							core.setFlag('debug_statusName', value);
							this.menu.drawContent();
						} else {
							core.drawFailTip('错误：不合法的名称!');
						}
					}, () => { });
				},
				text: '',
				replay: false,
				/** @this {SettingButton} */
				draw: function (ctx) {
					core.strokeRect(ctx, this.x, this.y, this.w, this.h, ' #708090');
				},
			},
			debug_statusValue: {
				getName: () => {
					let value = core.getFlag('debug_statusValue', '??');
					if (typeof value === 'number') return core.formatBigNumber(value, 5);
					else return value;
				},
				/** @this {ConsoleMenu} */
				effect: function () {
					core.utils.myprompt('输入要修改到的值', null, (input) => {
						const value = parseInt(input);
						if (!Number.isNaN(value)) {
							core.setFlag('debug_statusValue', value);
							this.menu.drawContent();
						} else {
							core.drawFailTip('错误：不合法的值!');
						}
					}, () => { });
				},
				text: '',
				replay: false,
				/** @this {SettingButton} */
				draw: function (ctx) {
					core.strokeRect(ctx, this.x, this.y, this.w, this.h, ' #708090');
				},
			},
			debug_setStatus: {
				getName: () => '',
				/** @this {ConsoleMenu} */
				effect: function () {
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
				text: '将角色状态设为相应值。',
				replay: false,
				/** @this {SettingButton} */
				draw: function (ctx) {
					core.fillRoundRect(ctx, this.x, this.y, this.w, this.h, 3, ' #D3D3D3');
					core.strokeRoundRect(ctx, this.x, this.y, this.w, this.h, 3, ' #888888');
					core.fillText(ctx, '执行', this.x + 5, this.y + this.h / 2 + 5, ' #333333', '16px Verdana');
				},
			},
			debug_itemName: {
				getName: () => core.getFlag('debug_itemName', '??'),
				/** @this {ConsoleMenu} */
				effect: function () {
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
				text: '',
				replay: false,
				/** @this {SettingButton} */
				draw: function (ctx) {
					core.strokeRect(ctx, this.x, this.y, this.w, this.h, ' #708090');
				},
			},
			debug_itemValue: {
				getName: () => core.getFlag('debug_itemValue', '??'),
				/** @this {ConsoleMenu} */
				effect: function () {
					core.setFlag('debug', true);
					core.utils.myprompt('输入要修改到的值', null, (input) => {
						const value = parseInt(input);
						if (!Number.isNaN(value)) {
							core.setFlag('debug_itemValue', value);
							this.menu.drawContent();
						} else {
							core.drawFailTip('错误：不合法的值!');
						}
					}, () => { });
				},
				text: '',
				replay: false,
				/** @this {SettingButton} */
				draw: function (ctx) {
					core.strokeRect(ctx, this.x, this.y, this.w, this.h, ' #708090');
				},
			},
			debug_setItem: {
				getName: () => '',
				/** @this {ConsoleMenu} */
				effect: function () {
					const name = core.getFlag('debug_itemName'),
						value = core.getFlag('debug_itemValue');
					const itemInfo = core.material.items;

					if (name && itemInfo) {
						let itemExist = Object.values(itemInfo).some((item) => item.id === name);
						if (!itemExist) {
							core.drawFailTip('错误：不合法的名称!');
							return;
						}
					} else {
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
				text: '将道具数设为相应值。',
				replay: false,
				/** @this {SettingButton} */
				draw: function (ctx) {
					core.fillRoundRect(ctx, this.x, this.y, this.w, this.h, 3, ' #D3D3D3');
					core.strokeRoundRect(ctx, this.x, this.y, this.w, this.h, 3, ' #888888');
					core.fillText(ctx, '执行', this.x + 5, this.y + this.h / 2 + 5, ' #333333', '16px Verdana');
				},
			},
			debug_flagName: {
				getName: () => core.getFlag('debug_flagName', '??'),
				/** @this {ConsoleMenu} */
				effect: function () {
					core.setFlag('debug', true);
					core.utils.myprompt('输入要修改的变量名。注意：如果您不了解修改变量的后果，请勿尝试。', null, (value) => {
						if (!value.startsWith('debug')) {
							core.setFlag('debug_flagName', value);
							this.menu.drawContent();
						} else {
							core.drawFailTip('错误：不合法的名称!');
						}
					}, () => { });
				},
				text: '',
				replay: false,
				/** @this {SettingButton} */
				draw: function (ctx) {
					core.strokeRect(ctx, this.x, this.y, this.w, this.h, ' #708090');
				},
			},
			debug_flagValue: {
				getName: () => core.getFlag('debug_flagValue', '??'),
				/** @this {ConsoleMenu} */
				effect: function () {
					core.setFlag('debug', true);
					core.utils.myprompt('输入要修改到的值。注意：如果您不了解修改变量的后果，请勿尝试。', null, (value) => {
						let newValue;
						try {
							newValue = JSON.parse(value.trim());
						} catch {
							core.drawFailTip('错误：不合法的值，无法解析!');
							return;
						}
						core.setFlag('debug_flagValue', newValue);
						this.menu.drawContent();
					}, () => { });
				},
				text: '',
				replay: false,
				/** @this {SettingButton} */
				draw: function (ctx) {
					core.strokeRect(ctx, this.x, this.y, this.w, this.h, ' #708090');
				},
			},
			debug_setFlag: {
				getName: () => '',
				/** @this {ConsoleMenu} */
				effect: function () {
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
				text: '将变量设为相应值。',
				replay: false,
				/** @this {SettingButton} */
				draw: function (ctx) {
					core.fillRoundRect(ctx, this.x, this.y, this.w, this.h, 3, ' #D3D3D3');
					core.strokeRoundRect(ctx, this.x, this.y, this.w, this.h, 3, ' #888888');
					core.fillText(ctx, '执行', this.x + 5, this.y + this.h / 2 + 5, ' #333333', '16px Verdana');
				},
			},
		};

		class ConsoleMenu extends SettingOnePage {
			constructor() {
				super('console', consoleSetting);
				this.menu = this;
			}

			drawContent() {
				const ctx = this.createCanvas();
				const consoleWarnText =
					"本页面的功能仅供调试用。使用后相应存档将变红，录像不能通过，且无法提交。请读档到普通存档后正常游玩方可提交。";
				core.setTextAlign(ctx, 'left');
				core.setTextBaseline(ctx, 'alphabetic');
				core.fillText(ctx, "本页面的功能仅供调试用。使用后相应存档将变红，录像", 30, 170, " #FFC0CB", '14px Verdana');
				core.fillText(ctx, "不能通过，且无法提交。请读档到普通存档后正常游玩方", 30, 190, " #FFC0CB", '14px Verdana');
				core.fillText(ctx, "可提交。", 30, 210, " #FFC0CB", '14px Verdana');
				core.fillText(ctx, "属性", 45, 264, 'white', '16px Verdana');
				core.fillText(ctx, "设为", 170, 264, 'white', '16px Verdana');
				core.fillText(ctx, "物品", 45, 290, 'white', '16px Verdana');
				core.fillText(ctx, "数量设为", 170, 290, 'white', '16px Verdana');
				core.fillText(ctx, "变量", 45, 316, 'white', '16px Verdana');
				core.fillText(ctx, "设为", 170, 316, 'white', '16px Verdana');
				super.drawContent(ctx);
			}
		}

		function consoleMenuFactory() {
			const consoleMenu = new ConsoleMenu();
			consoleMenu.registerSettingBtns([
				['1,1', 'debug_wallHacking', new SettingButton(40, 220, 150, 25)],
				['1,2', 'debug_statusName', new SettingButton(80, 250, 80, 20)],
				['2,2', 'debug_statusValue', new SettingButton(210, 250, 80, 20)],
				['3,2', 'debug_setStatus', new SettingButton(340, 250, 40, 20)],
				['1,3', 'debug_itemName', new SettingButton(80, 276, 80, 20)],
				['2,3', 'debug_itemValue', new SettingButton(240, 276, 80, 20)],
				['3,3', 'debug_setItem', new SettingButton(340, 276, 40, 20)],
				['1,4', 'debug_flagName', new SettingButton(80, 302, 80, 20)],
				['2,4', 'debug_flagValue', new SettingButton(210, 302, 80, 20)],
				['3,4', 'debug_setFlag', new SettingButton(340, 302, 40, 20)],
			]);
			return consoleMenu;
		}
		// #endregion
		// #region 敌人信息显示调节界面
		const infoNameMap = {
			'damage': '伤害', 'critical': '临界', 'hp': core.control.getStatusLabel('hp'),
			'atk': core.control.getStatusLabel('atk'), 'def': core.control.getStatusLabel('def'),
			'money': core.control.getStatusLabel('money'), 'exp': core.control.getStatusLabel('exp'),
			'criticalDamage': '临界减伤', 'defDamage': '1防减伤', 'special': '特殊属性',
			'notBomb': '不可炸',
		}

		class DisplayInfoBtn extends RoundBtn {
			constructor(x, y, w, h, pos, index) {
				super(x, y, w, h);
				this.pos = pos;
				this.index = index;
			}

			draw() {
				super.draw();
				const isEmpty = !this.infoName;
				const ctx = this.ctx;
				const { x, y, w, h } = this;
				const [x0, y0, r, offset] = [x + w + 15, y + h / 2, h / 2 - 2, 2];
				core.fillCircle(ctx, x0, y0, r, isEmpty ? 'lime' : 'red');
				core.drawLine(ctx, x0 - r + offset, y0, x0 + r - offset, y0, 'white', 2);
				if (isEmpty) core.drawLine(ctx, x0, y0 - r + offset, x0, y0 + r - offset, 'white', 2);
			}

			inRange(px, py) { // 实际的点击判定区是右边的圆形
				const { x, y, w, h } = this;
				return px >= x + w + 15 - h / 2 && px <= x + w + 15 + h / 2 && py >= y && py <= y + h;
			}
		}

		class SpecialIconBtn extends RoundBtn { }

		class AdvanceDisplayMenu extends MenuBase {
			constructor() {
				super('advanceDisplay', ['ondown']);
				this.selectedBtn = null;
				this.getData();
				this.getAllSpecials();
				this.getSpecialIconData();
				this.specialIconPage = 0;
			}

			drawContent() {
				const ctx = this.createCanvas();
				core.setTextAlign(ctx, 'center');
				core.setTextBaseline(ctx, 'alphabetic');
				core.fillRoundRect(ctx, 20, 70, core.__PIXELS__ - 40, 320, 5, "rgba(50,50,50,1)");
				core.fillText(ctx, "设定敌人左下角显示的数据", 110, 90, 'white', '14px Verdana');
				core.fillText(ctx, "设定敌人右上角显示的数据", 110, 190, 'white', '14px Verdana');
				core.fillText(ctx, "设定特殊属性的代表字符", 110, 290, 'white', '14px Verdana');
				this.getData();
				this.setInfoName();
				this.getSpecialIconData();
				super.drawContent(ctx);
			}

			clear() {
				super.clear();
				const settingMenu = core.plugin.settingMenu;
				if (settingMenu) {
					settingMenu.beginListen();
					settingMenu.pageList[settingMenu.currPage].beginListen();
				}
			}

			getData() {
				const defaultData = { leftdown: { 1: 'damage', 2: 'critical' }, rightup: {} };
				this.data = core.getLocalStorage('displayData', defaultData);
			}

			setData(pos, index, infoName) {
				this.data[pos][index] = infoName;
				core.setLocalStorage('displayData', this.data);
				this.setInfoName();
			}

			setInfoName() {
				this.btnMap.forEach(btn => {
					if (!(btn instanceof DisplayInfoBtn)) return;
					const pos = btn.pos;
					const index = btn.index;
					const infoName = this.data[pos][index];
					if (infoName) {
						btn.infoName = infoName;
						const name = infoNameMap[infoName];
						btn.text = name;
					}
					else {
						btn.infoName = null;
						btn.text = '';
					}
				});
			}

			getAllSpecials() { // allSpecials是所有用到了的特殊属性的数组
				let allSpecialsSet = new Set();
				Object.values(core.material.enemys).forEach(enemy => {
					const special = core.utils.parseSpecial(enemy.special);
					allSpecialsSet = new Set([...allSpecialsSet, ...special]);
				})
				this.allSpecials = [...allSpecialsSet].sort((a, b) => a - b);
			}

			getSpecialIconData() {
				const specialData = core.getLocalStorage('specialIconData', {});
				this.specialIconData = specialData;
			}

			getCurrSpecialIconList() {
				return this.allSpecials.slice(this.specialIconPage * 6,
					this.specialIconPage * 6 + 6);
			}

			/** 更新每个按钮对应的文本，在翻页和修改内容时需要手动调用 */
			setSpecialIconBtnText() {
				const specialIconList = this.getCurrSpecialIconList();
				for (let i = 0; i <= 5; i++) {
					const key = 's' + (i + 1);
					const btn = this.btnMap.get(key);
					const index = this.specialIconPage * 6 + i;
					if (index >= this.allSpecials.length) {
						btn.text = '';
					}
					else {
						const specialNum = this.allSpecials[index];
						const specialIndexMap = core.enemys.getSpecialIndexMap();
						const [key, name] = specialIndexMap[specialNum];
						const icon = this.specialIconData[specialNum] || "无";
						btn.text = `${key}:${name} ${icon}`;
					}
				}
			}

			setSpecialIconData(index) {
				const specialIconList = this.getCurrSpecialIconList();
				const specialNum = specialIconList[index];
				if (!specialNum) return;
				core.utils.myprompt('输入该特殊属性的代表字符', null, (value) => {
					if (value.length > 1) value = value[0]; // 最多保留一位字符
					this.specialIconData[specialNum] = value;
					core.setLocalStorage('specialIconData', this.specialIconData);
					this.setSpecialIconBtnText();
					this.drawContent();
				});
			}

			pageUp() {
				if (this.specialIconPage * 6 + 6 < this.allSpecials.length) {
					this.specialIconPage++;
					this.setSpecialIconBtnText();
					this.drawContent();
				}
			}

			pageDown() {
				if (this.specialIconPage > 0) {
					this.specialIconPage--;
					this.setSpecialIconBtnText();
					this.drawContent();
				}
			}
		}

		function advanceDisplayFactory() {
			const advanceDisplayMenu = new AdvanceDisplayMenu();
			const exitBtn = new ExitBtn(370, 80, 16, 16, { radius: 1, lineOffsetX: 2, lineWidthX: 2 })
			advanceDisplayMenu.registerBtn('exitBtn', exitBtn, () => {
				advanceDisplayMenu.clear();
				const settingMenu = core.plugin.settingMenu;
				settingMenu.btnMap.forEach(btn => { btn.disable = false });
				settingMenu.drawContent();
			});
			const btn1 = new DisplayInfoBtn(50, 100, 75, 20, 'leftdown', 1),
				btn2 = new DisplayInfoBtn(50, 125, 75, 20, 'leftdown', 2),
				btn3 = new DisplayInfoBtn(50, 150, 75, 20, 'leftdown', 3),
				btn4 = new DisplayInfoBtn(50, 200, 75, 20, 'rightup', 1),
				btn5 = new DisplayInfoBtn(50, 225, 75, 20, 'rightup', 2),
				btn6 = new DisplayInfoBtn(50, 250, 75, 20, 'rightup', 3);
			const infoNameList = Object.keys(infoNameMap);
			const l = infoNameList.length;

			const setNewInfo = function (infoName) {
				return function () {
					const btn = advanceDisplayMenu.selectedBtn;
					if (!btn) return;
					advanceDisplayMenu.setData(btn.pos, btn.index, infoName);
					advanceDisplayMenu.btnMap.forEach((btn, key) => {
						if (btn.key.startsWith("temp")) btn.disable = true;
					});
					advanceDisplayMenu.selectedBtn = null;
					advanceDisplayMenu.drawContent();
					core.control.updateStatusBar(); // 手动刷新一下地图显伤
				}
			}
			const ROW_INFONAME = 6;
			for (let i = 0; i < ROW_INFONAME; i++) {
				const tempBtn = new RoundBtn(200, 100 + i * 25, 80, 20, infoNameMap[infoNameList[i]], { fillStyle: 'Azure' });
				tempBtn.disable = true;
				advanceDisplayMenu.registerBtn('temp' + i, tempBtn, setNewInfo(infoNameList[i]));
			}
			for (let i = ROW_INFONAME; i < l; i++) {
				const tempBtn = new RoundBtn(300, 100 + (i - ROW_INFONAME) * 25, 80, 20, infoNameMap[infoNameList[i]], { fillStyle: 'Azure' });
				tempBtn.disable = true;
				advanceDisplayMenu.registerBtn('temp' + i, tempBtn, setNewInfo(infoNameList[i]));
			}
			const change = function (btn) {
				return function () {
					if (btn.infoName) {
						advanceDisplayMenu.setData(btn.pos, btn.index, null);
					}
					else {
						if (advanceDisplayMenu.selectedBtn && advanceDisplayMenu.selectedBtn === btn) {
							// 点击左边刚点过的按钮会收起展开菜单
							advanceDisplayMenu.btnMap.forEach((btn, key) => {
								if (btn.key.startsWith("temp")) btn.disable = true;
							});
							advanceDisplayMenu.selectedBtn = null;
							advanceDisplayMenu.drawContent();
						} else {
							advanceDisplayMenu.selectedBtn = btn;
							advanceDisplayMenu.btnMap.forEach((btn, key) => {
								if (btn.key.startsWith("temp")) btn.disable = false;
							});
						}
					}
					advanceDisplayMenu.drawContent();
				}
			}
			advanceDisplayMenu.registerBtns([
				['1', btn1, change(btn1)], ['2', btn2, change(btn2)], ['3', btn3, change(btn3)],
				['4', btn4, change(btn4)], ['5', btn5, change(btn5)], ['6', btn6, change(btn6)],
			]);
			const config = { "font": "12px Verdana" };
			advanceDisplayMenu.registerBtn('s1', new SpecialIconBtn(50, 300, 80, 20, "", config), advanceDisplayMenu.setSpecialIconData.bind(advanceDisplayMenu, 0));
			advanceDisplayMenu.registerBtn('s2', new SpecialIconBtn(150, 300, 80, 20, "", config), advanceDisplayMenu.setSpecialIconData.bind(advanceDisplayMenu, 1));
			advanceDisplayMenu.registerBtn('s3', new SpecialIconBtn(250, 300, 80, 20, "", config), advanceDisplayMenu.setSpecialIconData.bind(advanceDisplayMenu, 2));
			advanceDisplayMenu.registerBtn('s4', new SpecialIconBtn(50, 330, 80, 20, "", config), advanceDisplayMenu.setSpecialIconData.bind(advanceDisplayMenu, 3));
			advanceDisplayMenu.registerBtn('s5', new SpecialIconBtn(150, 330, 80, 20, "", config), advanceDisplayMenu.setSpecialIconData.bind(advanceDisplayMenu, 4));
			advanceDisplayMenu.registerBtn('s6', new SpecialIconBtn(250, 330, 80, 20, "", config), advanceDisplayMenu.setSpecialIconData.bind(advanceDisplayMenu, 5));
			advanceDisplayMenu.registerBtn('pageDown', new ArrowBtn(50, 360, 16, 16, 'left'),
				advanceDisplayMenu.pageDown.bind(advanceDisplayMenu));
			advanceDisplayMenu.registerBtn('pageUp', new ArrowBtn(320, 360, 16, 16, 'right'),
				advanceDisplayMenu.pageUp.bind(advanceDisplayMenu));
			advanceDisplayMenu.setSpecialIconBtnText();
			return advanceDisplayMenu;
		}
		// #endregion

		class PageChangeBtn extends RoundBtn {
			constructor(x, y, w, h, text) {
				super(x, y, w, h, text);
				/** @type {SettingBack} */ // @ts-ignore
				this.menu;
				this.ondown = () => this.menu.changePage(this.key);
			}
		}

		class SettingBack extends Pagination {
			constructor(pageList, currPage, name) {
				super(pageList, currPage, name, ['ondown', 'keyDown']);
			}

			changePage(index) {
				this.btnMap.forEach((btn, key) => {
					btn.status = (key === index) ? 'selected' : 'none';
				});
				super.changePage(index);
				this.drawContent();
			}

			/** @override */
			keyDownEvent(keyCode) {
				if (keyCode === KeyCodeEnum.PageDown) this.pageDown();
				else if (keyCode === KeyCodeEnum.PageUp) this.pageUp();
				else if (keyCode === KeyCodeEnum.Esc) this.quit();
			}

			quit() {
				this.clear();
				setTimeout(core.unlockControl, 0); // 消抖，防止点击关闭按钮的一瞬间触发瞬移。
			}

			drawSettingBackGround(ctx) {
				core.strokeRoundRect(ctx, 0, 0, core.__PIXELS__, core.__PIXELS__, 5, "white", 2);
				core.fillRoundRect(ctx, 0, 0, core.__PIXELS__, core.__PIXELS__, 5, "gray");

				// 绘制设置说明的文本框
				core.strokeRoundRect(ctx, 20, 70, core.__PIXELS__ - 40, 70, 3, "white");
				core.fillRoundRect(ctx, 21, 71, core.__PIXELS__ - 42, 68, 3, " #555555");

				// 绘制设置的框体
				core.strokeRoundRect(ctx, 20, 150, core.__PIXELS__ - 40, 256, 3, "white");
				core.fillRoundRect(ctx, 21, 151, core.__PIXELS__ - 42, 254, 3, " #999999");

				core.setTextAlign(ctx, 'center');
				core.ui.fillText(ctx, "设置", core.__PIXELS__ / 2, 25, 'white', '20px Verdana');
			}

			drawContent() {
				const ctx = core.createCanvas(this.name, this.x, this.y, this.w, this.h, 136);
				this.drawSettingBackGround(ctx);
				super.drawContent();
				// this.initOnePage(this.currPage);
			}
		}

		const allSettings = {
			...gamePlaySetting,
			...gameViewSetting,
			...keySetting,
			...consoleSetting,
		};
		// 注册点击SettingButton的行为cSet， 只有replay为真时计入录像
		core.registerReplayAction('cSet', (action) => {
			const strArr = action.split(':');
			if (strArr[0] !== 'cSet') return false;
			const currSetting = allSettings[strArr[1]]; //@todo bugfix
			if (!currSetting || !currSetting.replay || strArr[1].startsWith('debug')) return false;

			let params = strArr.slice(2);

			if (params.length > 0) {
				currSetting.effect.apply(currSetting, params);
			} else {
				currSetting.effect.call(currSetting);
			}

			core.status.route.push(action);
			core.replay();
			return true;
		});

		this.openSetting = function () {
			if (core.isReplaying()) return;
			core.lockControl();
			const ctx = 'setting';

			const gamePlayMenu = gamePlayFactory();
			const gameViewMenu = gameViewFactory();
			const keyMenu = keyMenuFactory();
			const toolBarMenu = toolBarConfigFactory();
			const consoleMenu = consoleMenuFactory();

			// 在此处添加新的菜单页面
			const settingMenu = new SettingBack([gamePlayMenu, gameViewMenu, keyMenu, toolBarMenu, consoleMenu], 0, ctx);

			// 主页面的按钮列表
			const gamePlayBtn = new PageChangeBtn(32, 40, 46, 24, '功能'),
				gameViewBtn = new PageChangeBtn(92, 40, 46, 24, '音画'),
				keyBtn = new PageChangeBtn(152, 40, 46, 24, '按键'),
				toolBarBtn = new PageChangeBtn(212, 40, 66, 24, '工具栏'),
				consoleBtn = new PageChangeBtn(292, 40, 66, 24, '控制台');
			const quit = new TextButton(360, 10, 45, 25, '[退出]');

			settingMenu.registerBtns([
				[0, gamePlayBtn],
				[1, gameViewBtn],
				[2, keyBtn],
				[3, toolBarBtn],
				[4, consoleBtn],
				['quit', quit, () => settingMenu.quit()]
			]);

			// 放缩时重绘整个大menu
			core.plugin.settingMenu = settingMenu;
			// 设置初始时选中的按键为第一个按键
			gamePlayBtn.status = 'selected';

			settingMenu.init();
			settingMenu.changePage(0);
		}
		// @todo 新版存档界面
	},
	"opusAdaptation": function () {
		// 将__enable置为false将关闭插件
		let __enable = true;
		if (!__enable || main.mode === "editor") return;
		const { OggOpusDecoderWebWorker } = window["ogg-opus-decoder"];
		const { OggVorbisDecoderWebWorker } = window["ogg-vorbis-decoder"];
		const { CodecParser } = window.CodecParser;
		const { Transition, linear } = core.plugin.animate;

		const audio = new Audio();
		const AudioStatus = {
			Playing: 0,
			Pausing: 1,
			Paused: 2,
			Stoping: 3,
			Stoped: 4,
		};
		const supportMap = new Map();
		const AudioType = {
			Mp3: "audio/mpeg",
			Wav: 'audio/wav; codecs="1"',
			Flac: "audio/flac",
			Opus: 'audio/ogg; codecs="opus"',
			Ogg: 'audio/ogg; codecs="vorbis"',
			Aac: "audio/aac",
		};
		/**
		 * 检查一种音频类型是否能被播放
		 * @param type 音频类型 AudioType
		 */
		function isAudioSupport(type) {
			if (supportMap.has(type)) return supportMap.get(type);
			else {
				const support = audio.canPlayType(type);
				const canPlay = support === "maybe" || support === "probably";
				supportMap.set(type, canPlay);
				return canPlay;
			}
		}

		const typeMap = new Map([
			["ogg", AudioType.Ogg],
			["mp3", AudioType.Mp3],
			["wav", AudioType.Wav],
			["flac", AudioType.Flac],
			["opus", AudioType.Opus],
			["aac", AudioType.Aac],
		]);

		/**
		 * 根据文件名拓展猜测其类型
		 * @param file 文件名 string
		 */
		function guessTypeByExt(file) {
			const ext = /\.[a-zA-Z\d]+$/.exec(file);
			if (!ext?.[0]) return "";
			const type = ext[0].slice(1);
			return typeMap.get(type.toLocaleLowerCase()) ?? "";
		}

		isAudioSupport(AudioType.Ogg);
		isAudioSupport(AudioType.Mp3);
		isAudioSupport(AudioType.Wav);
		isAudioSupport(AudioType.Flac);
		isAudioSupport(AudioType.Opus);
		isAudioSupport(AudioType.Aac);

		function isNil(value) {
			return value === void 0 || value === null;
		}

		function sleep(time) {
			return new Promise((res) => setTimeout(res, time));
		}
		class AudioEffect {
			constructor(ac) { }
			/**
			 * 连接至其他效果器
			 * @param target 目标输入 IAudioInput
			 * @param output 当前效果器输出通道 Number
			 * @param input 目标效果器的输入通道 Number
			 */
			connect(target, output, input) {
				this.output.connect(target.input, output, input);
			}

			/**
			 * 与其他效果器取消连接
			 * @param target 目标输入 IAudioInput
			 * @param output 当前效果器输出通道 Number
			 * @param input 目标效果器的输入通道 Number
			 */
			disconnect(target, output, input) {
				if (!target) {
					if (!isNil(output)) {
						this.output.disconnect(output);
					} else {
						this.output.disconnect();
					}
				} else {
					if (!isNil(output)) {
						if (!isNil(input)) {
							this.output.disconnect(target.input, output, input);
						} else {
							this.output.disconnect(target.input, output);
						}
					} else {
						this.output.disconnect(target.input);
					}
				}
			}
		}

		class StereoEffect extends AudioEffect {
			constructor(ac) {
				super(ac);
				const panner = ac.createPanner();
				this.input = panner;
				this.output = panner;
			}

			/**
			 * 设置音频朝向，x正方形水平向右，y正方形垂直于地面向上，z正方向垂直屏幕远离用户
			 * @param x 朝向x坐标 Number
			 * @param y 朝向y坐标 Number
			 * @param z 朝向z坐标 Number
			 */
			setOrientation(x, y, z) {
				this.output.orientationX.value = x;
				this.output.orientationY.value = y;
				this.output.orientationZ.value = z;
			}
			/**
			 * 设置音频位置，x正方形水平向右，y正方形垂直于地面向上，z正方向垂直屏幕远离用户
			 * @param x 位置x坐标 Number
			 * @param y 位置y坐标 Number
			 * @param z 位置z坐标 Number
			 */
			setPosition(x, y, z) {
				this.output.positionX.value = x;
				this.output.positionY.value = y;
				this.output.positionZ.value = z;
			}
			end() { }

			start() { }
		}
		class VolumeEffect extends AudioEffect {
			constructor(ac) {
				super(ac);
				const gain = ac.createGain();
				this.input = gain;
				this.output = gain;
			}

			/**
			 * 设置音量大小
			 * @param volume 音量大小 Number
			 */
			setVolume(volume) {
				this.output.gain.value = volume;
			}

			/**
			 * 获取音量大小 Number
			 */
			getVolume() {
				return this.output.gain.value;
			}

			end() { }

			start() { }
		}
		class ChannelVolumeEffect extends AudioEffect {
			/** 所有的音量控制节点 */

			constructor(ac) {
				super(ac);
				/** 所有的音量控制节点 */
				this.gain = [];
				const splitter = ac.createChannelSplitter();
				const merger = ac.createChannelMerger();
				this.output = merger;
				this.input = splitter;
				for (let i = 0; i < 6; i++) {
					const gain = ac.createGain();
					splitter.connect(gain, i);
					gain.connect(merger, 0, i);
					this.gain.push(gain);
				}
			}

			/**
			 * 设置某个声道的音量大小
			 * @param channel 要设置的声道，可填0-5 Number
			 * @param volume 这个声道的音量大小 Number
			 */
			setVolume(channel, volume) {
				if (!this.gain[channel]) return;
				this.gain[channel].gain.value = volume;
			}

			/**
			 * 获取某个声道的音量大小，可填0-5
			 * @param channel 要获取的声道 Number
			 */
			getVolume(channel) {
				if (!this.gain[channel]) return 0;
				return this.gain[channel].gain.value;
			}

			end() { }

			start() { }
		}
		class DelayEffect extends AudioEffect {
			constructor(ac) {
				super(ac);

				const delay = ac.createDelay();
				this.input = delay;
				this.output = delay;
			}

			/**
			 * 设置延迟时长
			 * @param delay 延迟时长，单位秒 Number
			 */
			setDelay(delay) {
				this.output.delayTime.value = delay;
			}

			/**
			 * 获取延迟时长
			 */
			getDelay() {
				return this.output.delayTime.value;
			}

			end() { }

			start() { }
		}
		class EchoEffect extends AudioEffect {
			constructor(ac) {
				super(ac);
				/** 当前增益 */
				this.gain = 0.5;
				/** 是否正在播放 */
				this.playing = false;
				const delay = ac.createDelay();
				const gain = ac.createGain();
				gain.gain.value = 0.5;
				delay.delayTime.value = 0.05;
				delay.connect(gain);
				gain.connect(delay);
				/** 延迟节点 */
				this.delay = delay;
				/** 反馈增益节点 */
				this.gainNode = gain;

				this.input = gain;
				this.output = gain;
			}

			/**
			 * 设置回声反馈增益大小
			 * @param gain 增益大小，范围 0-1，大于等于1的视为0.5，小于0的视为0 Number
			 */
			setFeedbackGain(gain) {
				const resolved = gain >= 1 ? 0.5 : gain < 0 ? 0 : gain;
				this.gain = resolved;
				if (this.playing) this.gainNode.gain.value = resolved;
			}

			/**
			 * 设置回声间隔时长
			 * @param delay 回声时长，范围 0.01-Infinity，小于0.01的视为0.01 Number
			 */
			setEchoDelay(delay) {
				const resolved = delay < 0.01 ? 0.01 : delay;
				this.delay.delayTime.value = resolved;
			}

			/**
			 * 获取反馈节点增益
			 */
			getFeedbackGain() {
				return this.gain;
			}

			/**
			 * 获取回声间隔时长
			 */
			getEchoDelay() {
				return this.delay.delayTime.value;
			}

			end() {
				this.playing = false;
				const echoTime = Math.ceil(Math.log(0.001) / Math.log(this.gain)) + 10;
				sleep(this.delay.delayTime.value * echoTime).then(() => {
					if (!this.playing) this.gainNode.gain.value = 0;
				});
			}

			start() {
				this.playing = true;
				this.gainNode.gain.value = this.gain;
			}
		}

		class StreamLoader {
			constructor(url) {
				/** 传输目标  Set<IStreamReader> */
				this.target = new Set();
				this.loading = false;
			}

			/**
			 * 将加载流传递给字节流读取对象
			 * @param reader 字节流读取对象 IStreamReader
			 */
			pipe(reader) {
				if (this.loading) {
					console.warn(
						"Cannot pipe new StreamReader object when stream is loading."
					);
					return;
				}
				this.target.add(reader);
				reader.piped(this);
				return this;
			}

			async start() {
				if (this.loading) return;
				this.loading = true;
				const response = await window.fetch(this.url);
				const stream = response.body;
				if (!stream) {
					console.error("Cannot get reader when fetching '" + this.url + "'.");
					return;
				}
				// 获取读取器
				this.stream = stream;
				const reader = response.body?.getReader();
				const targets = [...this.target];

				await Promise.all(targets.map((v) => v.start(stream, this, response)));
				if (reader && reader.read) {
					// 开始流传输
					while (true) {
						const { value, done } = await reader.read();
						await Promise.all(
							targets.map((v) => v.pump(value, done, response))
						);
						if (done) break;
					}
				} else {
					// 如果不支持流传输
					const buffer = await response.arrayBuffer();
					const data = new Uint8Array(buffer);
					await Promise.all(targets.map((v) => v.pump(data, true, response)));
				}

				this.loading = false;
				targets.forEach((v) => v.end(true));
			}

			cancel(reason) {
				if (!this.stream) return;
				this.stream.cancel(reason);
				this.loading = false;
				this.target.forEach((v) => v.end(false, reason));
			}
		}

		/** @type {[string, number[]][]} */
		const fileSignatures = [
			[AudioType.Mp3, [0x49, 0x44, 0x33]],
			[AudioType.Ogg, [0x4f, 0x67, 0x67, 0x53]],
			[AudioType.Wav, [0x52, 0x49, 0x46, 0x46]],
			[AudioType.Flac, [0x66, 0x4c, 0x61, 0x43]],
			[AudioType.Aac, [0xff, 0xf1]],
			[AudioType.Aac, [0xff, 0xf9]],
		];
		/** @type {[string, number[]][]} */
		const oggHeaders = [
			[AudioType.Opus, [0x4f, 0x70, 0x75, 0x73, 0x48, 0x65, 0x61, 0x64]],
		];

		function checkAudioType(data) {
			let audioType = "";
			// 检查头文件获取音频类型，仅检查前256个字节
			const toCheck = data.slice(0, 256);
			for (const [type, value] of fileSignatures) {
				if (value.every((v, i) => toCheck[i] === v)) {
					audioType = type;
					break;
				}
			}
			if (audioType === AudioType.Ogg) {
				// 如果是ogg的话，进一步判断是不是opus
				for (const [key, value] of oggHeaders) {
					const has = toCheck.some((_, i) => {
						return value.every((v, ii) => toCheck[i + ii] === v);
					});
					if (has) {
						audioType = key;
						break;
					}
				}
			}

			return audioType;
		}
		class AudioDecoder {
			/**
			 * 注册一个解码器
			 * @param type 要注册的解码器允许解码的类型
			 * @param decoder 解码器对象
			 */
			static registerDecoder(type, decoder) {
				if (!this.decoderMap) this.decoderMap = new Map();
				if (this.decoderMap.has(type)) {
					console.warn(
						"Audio stream decoder for audio type '" +
						type +
						"' has already existed."
					);
					return;
				}

				this.decoderMap.set(type, decoder);
			}

			/**
			 * 解码音频数据
			 * @param data 音频文件数据
			 * @param player AudioPlayer实例
			 */
			static async decodeAudioData(data, player) {
				// 检查头文件获取音频类型，仅检查前256个字节
				const toCheck = data.slice(0, 256);
				const type = checkAudioType(data);
				if (type === "") {
					console.error(
						"Unknown audio type. Header: '" +
						[...toCheck]
							.map((v) => v.toString().padStart(2, "0"))
							.join(" ")
							.toUpperCase() +
						"'"
					);
					return null;
				}
				if (isAudioSupport(type)) {
					if (data.buffer instanceof ArrayBuffer) {
						return player.ac.decodeAudioData(data.buffer);
					} else {
						return null;
					}
				} else {
					const Decoder = this.decoderMap.get(type);
					if (!Decoder) {
						return null;
					} else {
						const decoder = new Decoder();
						await decoder.create();
						const decodedData = await decoder.decode(data);
						if (!decodedData) return null;
						const buffer = player.ac.createBuffer(
							decodedData.channelData.length,
							decodedData.channelData[0].length,
							decodedData.sampleRate
						);
						decodedData.channelData.forEach((v, i) => {
							buffer.copyToChannel(v, i);
						});
						decoder.destroy();
						return buffer;
					}
				}
			}
		}

		class VorbisDecoder {
			/**
			 * 创建音频解码器
			 */
			async create() {
				this.decoder = new OggVorbisDecoderWebWorker();
				await this.decoder.ready;
			}
			/**
			 * 摧毁这个解码器
			 */
			destroy() {
				this.decoder?.free();
			}
			/**
			 * 解码流数据
			 * @param data 流数据
			 */

			async decode(data) {
				return this.decoder?.decode(data);
			}
			/**
			 * 解码整个文件
			 * @param data 文件数据
			 */
			async decodeAll(data) {
				return this.decoder?.decodeFile(data);
			}
			/**
			 * 当音频解码完成后，会调用此函数，需要返回之前还未解析或未返回的音频数据。调用后，该解码器将不会被再次使用
			 */
			async flush() {
				return this.decoder?.flush();
			}
		}

		class OpusDecoder {
			/**
			 * 创建音频解码器
			 */
			async create() {
				this.decoder = new OggOpusDecoderWebWorker();
				await this.decoder.ready;
			}
			/**
			 * 摧毁这个解码器
			 */
			destroy() {
				this.decoder?.free();
			}
			/**
			 * 解码流数据
			 * @param data 流数据
			 */
			async decode(data) {
				return this.decoder?.decode(data);
			}
			/**
			 * 解码整个文件
			 * @param data 文件数据
			 */
			async decodeAll(data) {
				return this.decoder?.decodeFile(data);
			}
			/**
			 * 当音频解码完成后，会调用此函数，需要返回之前还未解析或未返回的音频数据。调用后，该解码器将不会被再次使用
			 */
			async flush() {
				return await this.decoder?.flush();
			}
		}
		const mimeTypeMap = {
			[AudioType.Aac]: "audio/aac",
			[AudioType.Flac]: "audio/flac",
			[AudioType.Mp3]: "audio/mpeg",
			[AudioType.Ogg]: "application/ogg",
			[AudioType.Opus]: "application/ogg",
			[AudioType.Wav]: "application/ogg",
		};

		function isOggPage(data) {
			return !isNil(data.isFirstPage);
		}
		class AudioStreamSource {
			constructor(context) {
				this.output = context.createBufferSource();
				/** 是否已经完全加载完毕 */
				this.loaded = false;
				/** 是否正在播放 */
				this.playing = false;
				/** 已经缓冲了多长时间，如果缓冲完那么跟歌曲时长一致 */
				this.buffered = 0;
				/** 已经缓冲的采样点数量 */
				this.bufferedSamples = 0;
				/** 歌曲时长，加载完毕之前保持为 0 */
				this.duration = 0;
				/** 在流传输阶段，至少缓冲多长时间的音频之后才开始播放，单位秒 */
				this.bufferPlayDuration = 1;
				/** 音频的采样率，未成功解析出之前保持为 0 */
				this.sampleRate = 0;
				//是否循环播放
				this.loop = false;
				/** 上一次播放是从何时开始的 */
				this.lastStartWhen = 0;
				/** 开始播放时刻 */
				this.lastStartTime = 0;
				/** 上一次播放的缓存长度 */
				this.lastBufferSamples = 0;

				/** 是否已经获取到头文件 */
				this.headerRecieved = false;
				/** 音频类型 */
				this.audioType = "";
				/** 每多长时间组成一个缓存 Float32Array */
				this.bufferChunkSize = 10;
				/** 缓存音频数据，每 bufferChunkSize 秒钟组成一个 Float32Array，用于流式解码 */
				this.audioData = [];

				this.errored = false;
				this.ac = context;
			}
			/** 当前已经播放了多长时间 */
			get currentTime() {
				return this.ac.currentTime - this.lastStartTime + this.lastStartWhen;
			}
			/**
			 * 设置每个缓存数据的大小，默认为10秒钟一个缓存数据
			 * @param size 每个缓存数据的时长，单位秒
			 */
			setChunkSize(size) {
				if (this.controller?.loading || this.loaded) return;
				this.bufferChunkSize = size;
			}

			piped(controller) {
				this.controller = controller;
			}

			async pump(data, done) {
				if (!data || this.errored) return;
				if (!this.headerRecieved) {
					// 检查头文件获取音频类型，仅检查前256个字节
					const toCheck = data.slice(0, 256);
					this.audioType = checkAudioType(data);
					if (!this.audioType) {
						console.error(
							"Unknown audio type. Header: '" +
							[...toCheck]
								.map((v) => v.toString(16).padStart(2, "0"))
								.join(" ")
								.toUpperCase() +
							"'"
						);
						return;
					}
					// 创建解码器
					const Decoder = AudioDecoder.decoderMap.get(this.audioType);
					if (!Decoder) {
						this.errored = true;
						console.error(
							"Cannot decode stream source type of '" +
							this.audioType +
							"', since there is no registered decoder for that type."
						);
						return Promise.reject(
							`Cannot decode stream source type of '${this.audioType}', since there is no registered decoder for that type.`
						);
					}
					this.decoder = new Decoder();
					// 创建数据解析器
					const mime = mimeTypeMap[this.audioType];
					const parser = new CodecParser(mime);
					this.parser = parser;
					await this.decoder.create();
					this.headerRecieved = true;
				}

				const decoder = this.decoder;
				const parser = this.parser;
				if (!decoder || !parser) {
					this.errored = true;
					return Promise.reject(
						"No parser or decoder attached in this AudioStreamSource"
					);
				}

				await this.decodeData(data, decoder, parser);
				if (done) await this.decodeFlushData(decoder, parser);
				this.checkBufferedPlay();
			}

			/**
			 * 检查采样率，如果还未解析出采样率，那么将设置采样率，如果当前采样率与之前不同，那么发出警告
			 */
			checkSampleRate(info) {
				for (const one of info) {
					const frame = isOggPage(one) ? one.codecFrames[0] : one;
					if (frame) {
						const rate = frame.header.sampleRate;
						if (this.sampleRate === 0) {
							this.sampleRate = rate;
							break;
						} else {
							if (rate !== this.sampleRate) {
								console.warn("Sample rate in stream audio must be constant.");
							}
						}
					}
				}
			}

			/**
			 * 解析音频数据
			 */
			async decodeData(data, decoder, parser) {
				// 解析音频数据
				const audioData = await decoder.decode(data);
				if (!audioData) return;
				// @ts-expect-error 库类型声明错误
				const audioInfo = [...parser.parseChunk(data)];

				// 检查采样率
				this.checkSampleRate(audioInfo);
				// 追加音频数据
				this.appendDecodedData(audioData, audioInfo);
			}

			/**
			 * 解码剩余数据
			 */
			async decodeFlushData(decoder, parser) {
				const audioData = await decoder.flush();
				if (!audioData) return;
				// @ts-expect-error 库类型声明错误
				const audioInfo = [...parser.flush()];

				this.checkSampleRate(audioInfo);
				this.appendDecodedData(audioData, audioInfo);
			}

			/**
			 * 追加音频数据
			 */
			appendDecodedData(data, info) {
				const channels = data.channelData.length;
				if (channels === 0) return;
				if (this.audioData.length !== channels) {
					this.audioData = [];
					for (let i = 0; i < channels; i++) {
						this.audioData.push([]);
					}
				}
				// 计算出应该放在哪
				const chunk = this.sampleRate * this.bufferChunkSize;
				const sampled = this.bufferedSamples;
				const pushIndex = Math.floor(sampled / chunk);
				const bufferIndex = sampled % chunk;
				const dataLength = data.channelData[0].length;
				let buffered = 0;
				let nowIndex = pushIndex;
				let toBuffer = bufferIndex;
				while (buffered < dataLength) {
					const rest = toBuffer !== 0 ? chunk - bufferIndex : chunk;

					for (let i = 0; i < channels; i++) {
						const audioData = this.audioData[i];
						if (!audioData[nowIndex]) {
							audioData.push(new Float32Array(chunk));
						}
						const toPush = data.channelData[i].slice(buffered, buffered + rest);

						audioData[nowIndex].set(toPush, toBuffer);
					}
					buffered += rest;
					nowIndex++;
					toBuffer = 0;
				}

				this.buffered +=
					info.reduce((prev, curr) => prev + curr.duration, 0) / 1000;
				this.bufferedSamples += info.reduce(
					(prev, curr) => prev + curr.samples,
					0
				);
			}

			/**
			 * 检查已缓冲内容，并在未开始播放时播放
			 */
			checkBufferedPlay() {
				if (this.playing || this.sampleRate === 0) return;
				const played = this.lastBufferSamples / this.sampleRate;
				const dt = this.buffered - played;
				if (this.loaded) {
					this.playAudio(played);
					return;
				}
				if (dt < this.bufferPlayDuration) return;

				this.lastBufferSamples = this.bufferedSamples;
				// 需要播放
				this.mergeBuffers();
				if (!this.buffer) return;
				if (this.playing) this.output.stop();
				this.createSourceNode(this.buffer);
				this.output.loop = false;
				this.output.start(0, played);
				this.lastStartTime = this.ac.currentTime;
				this.playing = true;
				this.output.addEventListener("ended", () => {
					this.playing = false;
					this.checkBufferedPlay();
				});
			}

			mergeBuffers() {
				const buffer = this.ac.createBuffer(
					this.audioData.length,
					this.bufferedSamples,
					this.sampleRate
				);
				const chunk = this.sampleRate * this.bufferChunkSize;
				const bufferedChunks = Math.floor(this.bufferedSamples / chunk);
				const restLength = this.bufferedSamples % chunk;
				for (let i = 0; i < this.audioData.length; i++) {
					const audio = this.audioData[i];
					const data = new Float32Array(this.bufferedSamples);
					for (let j = 0; j < bufferedChunks; j++) {
						data.set(audio[j], chunk * j);
					}
					if (restLength !== 0) {
						data.set(
							audio[bufferedChunks].slice(0, restLength),
							chunk * bufferedChunks
						);
					}

					buffer.copyToChannel(data, i, 0);
				}
				this.buffer = buffer;
			}

			async start() {
				delete this.buffer;
				this.headerRecieved = false;
				this.audioType = "";
				this.errored = false;
				this.buffered = 0;
				this.sampleRate = 0;
				this.bufferedSamples = 0;
				this.duration = 0;
				this.loaded = false;
				if (this.playing) this.output.stop();
				this.playing = false;
				this.lastStartTime = this.ac.currentTime;
			}

			end(done, reason) {
				if (done && this.buffer) {
					this.loaded = true;
					delete this.controller;
					this.mergeBuffers();

					this.duration = this.buffered;
					this.audioData = [];
					this.decoder?.destroy();
					delete this.decoder;
					delete this.parser;
				} else {
					console.warn(
						"Unexpected end when loading stream audio, reason: '" +
						(reason ?? "") +
						"'"
					);
				}
			}

			playAudio(when) {
				if (!this.buffer) return;
				this.lastStartTime = this.ac.currentTime;
				if (this.playing) this.output.stop();
				if (this.route.status !== AudioStatus.Playing) {
					this.route.status = AudioStatus.Playing;
				}
				this.createSourceNode(this.buffer);
				this.output.start(0, when);
				this.playing = true;

				this.output.addEventListener("ended", () => {
					this.playing = false;
					if (this.route.status === AudioStatus.Playing) {
						this.route.status = AudioStatus.Stoped;
					}
					if (this.loop && !this.output.loop) this.play(0);
				});
			}
			/**
			 * 开始播放这个音频源
			 */
			play(when) {
				if (this.playing || this.errored) return;
				if (this.loaded && this.buffer) {
					this.playing = true;
					this.playAudio(when);
				} else {
					this.controller?.start();
				}
			}

			createSourceNode(buffer) {
				if (!this.target) return;
				const node = this.ac.createBufferSource();
				node.buffer = buffer;
				if (this.playing) this.output.stop();
				this.playing = false;
				this.output = node;
				node.connect(this.target.input);
				node.loop = this.loop;
			}
			/**
			 * 停止播放这个音频源
			 * @returns 音频暂停的时刻 number
			 */
			stop() {
				if (this.playing) this.output.stop();
				this.playing = false;
				return this.ac.currentTime - this.lastStartTime;
			}
			/**
			 * 连接到音频路由图上，每次调用播放的时候都会执行一次
			 * @param target 连接至的目标 IAudioInput
			 */
			connect(target) {
				this.target = target;
			}
			/**
			 * 设置是否循环播放
			 * @param loop 是否循环 boolean)
			 */
			setLoop(loop) {
				this.loop = loop;
			}
		}
		class AudioElementSource {
			constructor(context) {
				const audio = new Audio();
				audio.preload = "none";
				this.output = context.createMediaElementSource(audio);
				this.audio = audio;
				this.ac = context;
				audio.addEventListener("play", () => {
					this.playing = true;
					if (this.route.status !== AudioStatus.Playing) {
						this.route.status = AudioStatus.Playing;
					}
				});
				audio.addEventListener("ended", () => {
					this.playing = false;
					if (this.route.status === AudioStatus.Playing) {
						this.route.status = AudioStatus.Stoped;
					}
				});
			}
			get duration() {
				return this.audio.duration;
			}
			get currentTime() {
				return this.audio.currentTime;
			}
			/**
			 * 设置音频源的路径
			 * @param url 音频路径
			 */
			setSource(url) {
				this.audio.src = url;
			}

			play(when = 0) {
				if (this.playing) return;
				this.audio.currentTime = when;
				this.audio.play();
			}

			stop() {
				this.audio.pause();
				this.playing = false;
				if (this.route.status === AudioStatus.Playing) {
					this.route.status = AudioStatus.Stoped;
				}
				return this.audio.currentTime;
			}

			connect(target) {
				this.output.connect(target.input);
			}

			setLoop(loop) {
				this.audio.loop = loop;
			}
		}
		class AudioBufferSource {
			constructor(context) {
				this.output = context.createBufferSource();
				/** 是否循环 */
				this.loop = false;
				/** 上一次播放是从何时开始的 */
				this.lastStartWhen = 0;
				/** 播放开始时刻 */
				this.lastStartTime = 0;
				this.duration = 0;
				this.ac = context;
			}
			get currentTime() {
				return this.ac.currentTime - this.lastStartTime + this.lastStartWhen;
			}

			/**
			 * 设置音频源数据
			 * @param buffer 音频源，可以是未解析的 ArrayBuffer，也可以是已解析的 AudioBuffer
			 */
			async setBuffer(buffer) {
				if (buffer instanceof ArrayBuffer) {
					this.buffer = await this.ac.decodeAudioData(buffer);
				} else {
					this.buffer = buffer;
				}
				this.duration = this.buffer.duration;
			}

			play(when) {
				if (this.playing || !this.buffer) return;
				this.playing = true;
				this.lastStartTime = this.ac.currentTime;
				if (this.route.status !== AudioStatus.Playing) {
					this.route.status = AudioStatus.Playing;
				}
				this.createSourceNode(this.buffer);
				this.output.start(0, when);
				this.output.addEventListener("ended", () => {
					this.playing = false;
					if (this.route.status === AudioStatus.Playing) {
						this.route.status = AudioStatus.Stoped;
					}
					if (this.loop && !this.output.loop) this.play(0);
				});
			}

			createSourceNode(buffer) {
				if (!this.target) return;
				const node = this.ac.createBufferSource();
				node.buffer = buffer;
				this.output = node;
				node.connect(this.target.input);
				node.loop = this.loop;
			}

			stop() {
				this.output.stop();
				return this.ac.currentTime - this.lastStartTime;
			}

			connect(target) {
				this.target = target;
			}

			setLoop(loop) {
				this.loop = loop;
			}
		}
		class AudioPlayer {
			constructor() {
				/** 音频播放上下文 */
				this.ac = new AudioContext();
				/** 音量节点 */
				this.gain = this.ac.createGain();
				this.gain.connect(this.ac.destination);
				this.audioRoutes = new Map();
			}
			/**
			 * 解码音频数据
			 * @param data 音频数据
			 */
			decodeAudioData(data) {
				return AudioDecoder.decodeAudioData(data, this);
			}
			/**
			 * 设置音量
			 * @param volume 音量
			 */
			setVolume(volume) {
				this.gain.gain.value = volume;
			}

			/**
			 * 获取音量
			 */
			getVolume() {
				return this.gain.gain.value;
			}

			/**
			 * 创建一个音频源
			 * @param Source 音频源类
			 */
			createSource(Source) {
				return new Source(this.ac);
			}

			/**
			 * 创建一个兼容流式音频源，可以与流式加载相结合，主要用于处理 opus ogg 不兼容的情况
			 */
			createStreamSource() {
				return new AudioStreamSource(this.ac);
			}

			/**
			 * 创建一个通过 audio 元素播放的音频源
			 */
			createElementSource() {
				return new AudioElementSource(this.ac);
			}

			/**
			 * 创建一个通过 AudioBuffer 播放的音频源
			 */
			createBufferSource() {
				return new AudioBufferSource(this.ac);
			}

			/**
			 * 获取音频目的地
			 */
			getDestination() {
				return this.gain;
			}

			/**
			 * 创建一个音频效果器
			 * @param Effect 效果器类
			 */
			createEffect(Effect) {
				return new Effect(this.ac);
			}

			/**
			 * 创建一个修改音量的效果器
			 * ```txt
			 *             |----------|
			 * Input ----> | GainNode | ----> Output
			 *             |----------|
			 * ```
			 */
			createVolumeEffect() {
				return new VolumeEffect(this.ac);
			}

			/**
			 * 创建一个立体声效果器
			 * ```txt
			 *             |------------|
			 * Input ----> | PannerNode | ----> Output
			 *             |------------|
			 * ```
			 */
			createStereoEffect() {
				return new StereoEffect(this.ac);
			}

			/**
			 * 创建一个修改单个声道音量的效果器
			 * ```txt
			 *                                  |----------|
			 *                               -> | GainNode | \
			 *             |--------------| /   |----------|  -> |------------|
			 * Input ----> | SplitterNode |        ......        | MergerNode | ----> Output
			 *             |--------------| \   |----------|  -> |------------|
			 *                               -> | GainNode | /
			 *                                  |----------|
			 * ```
			 */
			createChannelVolumeEffect() {
				return new ChannelVolumeEffect(this.ac);
			}

			/**
			 * 创建一个延迟效果器
			 *             |-----------|
			 * Input ----> | DelayNode | ----> Output
			 *             |-----------|
			 */
			createDelay() {
				return new DelayEffect(this.ac);
			}

			/**
			 * 创建一个回声效果器
			 * ```txt
			 *             |----------|
			 * Input ----> | GainNode | ----> Output
			 *        ^    |----------|   |
			 *        |                   |
			 *        |   |------------|  ↓
			 *        |-- | Delay Node | <--
			 *            |------------|
			 * ```
			 */
			createEchoEffect() {
				return new EchoEffect(this.ac);
			}

			/**
			 * 创建一个音频播放路由
			 * @param source 音频源
			 */
			createRoute(source) {
				return new AudioRoute(source, this);
			}

			/**
			 * 添加一个音频播放路由，可以直接被播放
			 * @param id 这个音频播放路由的名称
			 * @param route 音频播放路由对象
			 */
			addRoute(id, route) {
				if (!this.audioRoutes) this.audioRoutes = new Map();
				if (this.audioRoutes.has(id)) {
					console.warn(
						"Audio route with id of '" +
						id +
						"' has already existed. New route will override old route."
					);
				}
				this.audioRoutes.set(id, route);
			}

			/**
			 * 根据名称获取音频播放路由对象
			 * @param id 音频播放路由的名称
			 */
			getRoute(id) {
				return this.audioRoutes.get(id);
			}
			/**
			 * 移除一个音频播放路由
			 * @param id 要移除的播放路由的名称
			 */
			removeRoute(id) {
				this.audioRoutes.delete(id);
			}
			/**
			 * 播放音频
			 * @param id 音频名称
			 * @param when 从音频的哪个位置开始播放，单位秒
			 */
			play(id, when) {
				const route = this.getRoute(id);
				if (!route) {
					console.warn(
						"Cannot play audio route '" +
						id +
						"', since there is not added route named it."
					);
					return;
				}

				route.play(when);
			}

			/**
			 * 暂停音频播放
			 * @param id 音频名称
			 * @returns 当音乐真正停止时兑现
			 */
			pause(id) {
				const route = this.getRoute(id);
				if (!route) {
					console.warn(
						"Cannot pause audio route '" +
						id +
						"', since there is not added route named it."
					);
					return;
				}
				return route.pause();
			}

			/**
			 * 停止音频播放
			 * @param id 音频名称
			 * @returns 当音乐真正停止时兑现
			 */
			stop(id) {
				const route = this.getRoute(id);
				if (!route) {
					console.warn(
						"Cannot stop audio route '" +
						id +
						"', since there is not added route named it."
					);
					return;
				}
				return route.stop();
			}

			/**
			 * 继续音频播放
			 * @param id 音频名称
			 */
			resume(id) {
				const route = this.getRoute(id);
				if (!route) {
					console.warn(
						"Cannot pause audio route '" +
						id +
						"', since there is not added route named it."
					);
					return;
				}
				route.resume();
			}

			/**
			 * 设置听者位置，x正方向水平向右，y正方向垂直于地面向上，z正方向垂直屏幕远离用户
			 * @param x 位置x坐标
			 * @param y 位置y坐标
			 * @param z 位置z坐标
			 */
			setListenerPosition(x, y, z) {
				const listener = this.ac.listener;
				listener.positionX.value = x;
				listener.positionY.value = y;
				listener.positionZ.value = z;
			}

			/**
			 * 设置听者朝向，x正方向水平向右，y正方向垂直于地面向上，z正方向垂直屏幕远离用户
			 * @param x 朝向x坐标
			 * @param y 朝向y坐标
			 * @param z 朝向z坐标
			 */
			setListenerOrientation(x, y, z) {
				const listener = this.ac.listener;
				listener.forwardX.value = x;
				listener.forwardY.value = y;
				listener.forwardZ.value = z;
			}

			/**
			 * 设置听者头顶朝向，x正方向水平向右，y正方向垂直于地面向上，z正方向垂直屏幕远离用户
			 * @param x 头顶朝向x坐标
			 * @param y 头顶朝向y坐标
			 * @param z 头顶朝向z坐标
			 */
			setListenerUp(x, y, z) {
				const listener = this.ac.listener;
				listener.upX.value = x;
				listener.upY.value = y;
				listener.upZ.value = z;
			}
		}
		class AudioRoute {
			constructor(source, player) {
				source.route = this;
				this.output = source.output;

				/** 效果器路由图 */
				this.effectRoute = [];

				/** 结束时长，当音频暂停或停止时，会经过这么长时间之后才真正终止播放，期间可以做音频淡入淡出等效果 */
				this.endTime = 0;
				/** 暂停时播放了多长时间 */
				this.pauseCurrentTime = 0;
				/** 当前播放状态 */
				this.player = player;
				this.status = AudioStatus.Stoped;

				this.shouldStop = false;
				/**
				 * 每次暂停或停止时自增，用于判断当前正在处理的情况。
				 * 假如暂停后很快播放，然后很快暂停，那么需要根据这个来判断实际是否应该执行暂停后操作
				 */
				this.stopIdentifier = 0;
				/** 暂停时刻 */
				this.pauseTime = 0;
				this.source = source;
				this.source.player = player;
			}
			/** 音频时长，单位秒 */
			get duration() {
				return this.source.duration;
			}
			/** 当前播放了多长时间，单位秒 */
			get currentTime() {
				if (this.status === AudioStatus.Paused) {
					return this.pauseCurrentTime;
				} else {
					return this.source.currentTime;
				}
			}
			set currentTime(time) {
				this.source.stop();
				this.source.play(time);
			}
			/**
			 * 设置结束时间，暂停或停止时，会经过这么长时间才终止音频的播放，这期间可以做一下音频淡出的效果。
			 * @param time 暂停或停止时，经过多长时间之后才会结束音频的播放
			 */
			setEndTime(time) {
				this.endTime = time;
			}

			/**
			 * 当音频播放时执行的函数，可以用于音频淡入效果
			 * @param fn 音频开始播放时执行的函数
			 */
			onStart(fn) {
				this.audioStartHook = fn;
			}

			/**
			 * 当音频暂停或停止时执行的函数，可以用于音频淡出效果
			 * @param fn 音频在暂停或停止时执行的函数，不填时表示取消这个钩子。
			 *           包含两个参数，第一个参数是结束时长，第二个参数是当前音频播放路由对象
			 */
			onEnd(fn) {
				this.audioEndHook = fn;
			}

			/**
			 * 开始播放这个音频
			 * @param when 从音频的什么时候开始播放，单位秒
			 */
			async play(when = 0) {
				if (this.status === AudioStatus.Playing) return;
				this.link();
				await this.player.ac.resume();
				if (this.effectRoute.length > 0) {
					const first = this.effectRoute[0];
					this.source.connect(first);
					const last = this.effectRoute.at(-1);
					last.connect({ input: this.player.getDestination() });
				} else {
					this.source.connect({ input: this.player.getDestination() });
				}
				this.source.play(when);
				this.status = AudioStatus.Playing;
				this.pauseTime = 0;
				this.audioStartHook?.(this);
				this.startAllEffect();
				if (this.status !== AudioStatus.Playing) {
					this.status = AudioStatus.Playing;
				}
			}

			/**
			 * 暂停音频播放
			 */
			async pause() {
				if (this.status !== AudioStatus.Playing) return;
				this.status = AudioStatus.Pausing;
				this.stopIdentifier++;
				const identifier = this.stopIdentifier;
				if (this.audioEndHook) {
					this.audioEndHook(this.endTime, this);
					await sleep(this.endTime);
				}
				if (
					this.status !== AudioStatus.Pausing ||
					this.stopIdentifier !== identifier
				) {
					return;
				}
				this.pauseCurrentTime = this.source.currentTime;
				const time = this.source.stop();
				this.pauseTime = time;
				if (this.shouldStop) {
					this.status = AudioStatus.Stoped;
					this.endAllEffect();

					this.shouldStop = false;
				} else {
					this.status = AudioStatus.Paused;
					this.endAllEffect();
				}
				this.endAllEffect();
			}

			/**
			 * 继续音频播放
			 */
			resume() {
				if (this.status === AudioStatus.Playing) return;
				if (
					this.status === AudioStatus.Pausing ||
					this.status === AudioStatus.Stoping
				) {
					this.audioStartHook?.(this);

					return;
				}
				if (this.status === AudioStatus.Paused) {
					this.play(this.pauseTime);
				} else {
					this.play(0);
				}
				this.status = AudioStatus.Playing;
				this.pauseTime = 0;
				this.audioStartHook?.(this);
				this.startAllEffect();
			}

			/**
			 * 停止音频播放
			 */
			async stop() {
				if (this.status !== AudioStatus.Playing) {
					if (this.status === AudioStatus.Pausing) {
						this.shouldStop = true;
					}
					return;
				}
				this.status = AudioStatus.Stoping;
				this.stopIdentifier++;
				const identifier = this.stopIdentifier;
				if (this.audioEndHook) {
					this.audioEndHook(this.endTime, this);
					await sleep(this.endTime);
				}
				if (
					this.status !== AudioStatus.Stoping ||
					this.stopIdentifier !== identifier
				) {
					return;
				}
				this.source.stop();
				this.status = AudioStatus.Stoped;
				this.pauseTime = 0;
				this.endAllEffect();
			}

			/**
			 * 添加效果器
			 * @param effect 要添加的效果，可以是数组，表示一次添加多个
			 * @param index 从哪个位置开始添加，如果大于数组长度，那么加到末尾，如果小于0，那么将会从后面往前数。默认添加到末尾
			 */
			addEffect(effect, index) {
				if (isNil(index)) {
					if (effect instanceof Array) {
						this.effectRoute.push(...effect);
					} else {
						this.effectRoute.push(effect);
					}
				} else {
					if (effect instanceof Array) {
						this.effectRoute.splice(index, 0, ...effect);
					} else {
						this.effectRoute.splice(index, 0, effect);
					}
				}
				this.setOutput();
				if (this.source.playing) this.link();
			}

			/**
			 * 移除一个效果器
			 * @param effect 要移除的效果
			 */
			removeEffect(effect) {
				const index = this.effectRoute.indexOf(effect);
				if (index === -1) return;
				this.effectRoute.splice(index, 1);
				effect.disconnect();
				this.setOutput();
				if (this.source.playing) this.link();
			}

			setOutput() {
				const effect = this.effectRoute.at(-1);
				if (!effect) this.output = this.source.output;
				else this.output = effect.output;
			}

			/**
			 * 连接音频路由图
			 */
			link() {
				this.effectRoute.forEach((v) => v.disconnect());
				this.effectRoute.forEach((v, i) => {
					const next = this.effectRoute[i + 1];
					if (next) {
						v.connect(next);
					}
				});
			}

			startAllEffect() {
				this.effectRoute.forEach((v) => v.start());
			}

			endAllEffect() {
				this.effectRoute.forEach((v) => v.end());
			}
		}

		const audioPlayer = new AudioPlayer();

		class BgmController {
			constructor(player) {
				this.mainGain = player.createVolumeEffect();
				this.player = player;
				/** bgm音频名称的前缀 */
				this.prefix = "bgms.";
				/** 每个 bgm 的音量控制器 */
				this.gain = new Map();

				/** 正在播放的 bgm */
				this.playingBgm = "";
				/** 是否正在播放 */
				this.playing = false;

				/** 是否已经启用 */
				this.enabled = true;
				/** 是否屏蔽所有的音乐切换 */
				this.blocking = false;
				/** 渐变时长 */
				this.transitionTime = 2000;
			}

			/**
			 * 设置音频渐变时长
			 * @param time 渐变时长
			 */
			setTransitionTime(time) {
				this.transitionTime = time;
				for (const [, value] of this.gain) {
					value.transition.time(time);
				}
			}

			/**
			 * 屏蔽音乐切换
			 */
			blockChange() {
				this.blocking = true;
			}

			/**
			 * 取消屏蔽音乐切换
			 */
			unblockChange() {
				this.blocking = false;
			}

			/**
			 * 设置总音量大小
			 * @param volume 音量大小
			 */
			setVolume(volume) {
				this.mainGain.setVolume(volume);
				this._volume = volume;
			}
			/**
			 * 获取总音量大小
			 */
			getVolume() {
				return this.mainGain.getVolume();
			}
			/**
			 * 设置是否启用
			 * @param enabled 是否启用
			 */
			setEnabled(enabled) {
				if (enabled) this.resume();
				else this.stop();
				this.enabled = enabled;
			}

			/**
			 * 设置 bgm 音频名称的前缀
			 */
			setPrefix(prefix) {
				this.prefix = prefix;
			}

			getId(name) {
				return `${this.prefix}${name}`;
			}

			/**
			 * 根据 bgm 名称获取其 AudioRoute 实例
			 * @param id 音频名称
			 */
			get(id) {
				return this.player.getRoute(this.getId(id));
			}

			/**
			 * 添加一个 bgm
			 * @param id 要添加的 bgm 的名称
			 * @param url 指定 bgm 的加载地址
			 */
			addBgm(id, url = `project/bgms/${id}`) {
				const type = guessTypeByExt(id);
				if (!type) {
					console.warn(
						"Unknown audio extension name: '" +
						id.split(".").slice(0, -1).join(".") +
						"'"
					);
					return;
				}
				const gain = this.player.createVolumeEffect();
				if (isAudioSupport(type)) {
					const source = audioPlayer.createElementSource();
					source.setSource(url);
					source.setLoop(true);
					const route = new AudioRoute(source, audioPlayer);
					route.addEffect([gain, this.mainGain]);
					audioPlayer.addRoute(this.getId(id), route);
					this.setTransition(id, route, gain);
				} else {
					const source = audioPlayer.createStreamSource();
					const stream = new StreamLoader(url);
					stream.pipe(source);
					source.setLoop(true);
					const route = new AudioRoute(source, audioPlayer);
					route.addEffect([gain, this.mainGain]);
					audioPlayer.addRoute(this.getId(id), route);
					this.setTransition(id, route, gain);
				}
			}

			/**
			 * 移除一个 bgm
			 * @param id 要移除的 bgm 的名称
			 */
			removeBgm(id) {
				this.player.removeRoute(this.getId(id));
				const gain = this.gain.get(id);
				gain?.transition.ticker.destroy();
				this.gain.delete(id);
			}

			setTransition(id, route, gain) {
				const transition = new Transition();
				transition
					.time(this.transitionTime)
					.mode(linear())
					.transition("volume", 0);

				const tick = () => {
					gain.setVolume(transition.value.volume);
				};

				/**
				 * @param expect 在结束时应该是正在播放还是停止
				 */
				const setTick = async (expect) => {
					transition.ticker.remove(tick);
					transition.ticker.add(tick);
					const identifier = route.stopIdentifier;
					await sleep(this.transitionTime + 500);
					if (route.status === expect && identifier === route.stopIdentifier) {
						transition.ticker.remove(tick);
						if (route.status === AudioStatus.Playing) {
							gain.setVolume(1);
						} else {
							gain.setVolume(0);
						}
					}
				};

				route.onStart(async () => {
					transition.transition("volume", 1);
					setTick(AudioStatus.Playing);
				});
				route.onEnd(() => {
					transition.transition("volume", 0);
					setTick(AudioStatus.Paused);
				});
				route.setEndTime(this.transitionTime);

				this.gain.set(id, { effect: gain, transition });
			}

			/**
			 * 播放一个 bgm
			 * @param id 要播放的 bgm 名称
			 */
			play(id, when) {
				if (this.blocking) return;
				if (id !== this.playingBgm && this.playingBgm) {
					this.player.pause(this.getId(this.playingBgm));
				}
				this.playingBgm = id;
				if (!this.enabled) return;
				this.player.play(this.getId(id), when);
				this.playing = true;
			}

			/**
			 * 继续当前的 bgm
			 */
			resume() {
				if (this.blocking || !this.enabled || this.playing) return;
				if (this.playingBgm) {
					this.player.resume(this.getId(this.playingBgm));
				}
				this.playing = true;
			}

			/**
			 * 暂停当前的 bgm
			 */
			pause() {
				if (this.blocking || !this.enabled) return;
				if (this.playingBgm) {
					this.player.pause(this.getId(this.playingBgm));
				}
				this.playing = false;
			}

			/**
			 * 停止当前的 bgm
			 */
			stop() {
				if (this.blocking || !this.enabled) return;
				if (this.playingBgm) {
					this.player.stop(this.getId(this.playingBgm));
				}
				this.playing = false;
			}
		}
		const bgmController = new BgmController(audioPlayer);

		class SoundPlayer {
			constructor(player) {
				/** 每个音效的唯一标识符 */
				this.num = 0;
				this.enabled = true;
				this.gain = player.createVolumeEffect();
				/** 每个音效的数据 */
				this.buffer = new Map();
				/** 所有正在播放的音乐 */
				this.playing = new Set();
				this.player = player;
			}
			/**
			 * 设置是否启用音效
			 * @param enabled 是否启用音效
			 */
			setEnabled(enabled) {
				if (!enabled) this.stopAllSounds();
				this.enabled = enabled;
			}

			/**
			 * 设置音量大小
			 * @param volume 音量大小
			 */
			setVolume(volume) {
				this.gain.setVolume(volume);
			}
			/**
			 * 获取音量大小
			 */
			getVolume() {
				return this.gain.getVolume();
			}
			/**
			 * 添加一个音效
			 * @param id 音效名称
			 * @param data 音效的Uint8Array数据
			 */
			async add(id, data) {
				const buffer = await this.player.decodeAudioData(data);
				if (!buffer) {
					console.warn(
						"Cannot decode sound '" +
						id +
						"', since audio file may not supported by 2.b."
					);
					return;
				}
				this.buffer.set(id, buffer);
			}

			/**
			 * 播放一个音效
			 * @param id 音效名称
			 * @param position 音频位置，[0, 0, 0]表示正中心，x轴指向水平向右，y轴指向水平向上，z轴指向竖直向上
			 * @param orientation 音频朝向，[0, 1, 0]表示朝向前方
			 */
			play(id, position = [0, 0, 0], orientation = [1, 0, 0]) {
				if (!this.enabled || !id) return -1;
				const buffer = this.buffer.get(id);
				if (!buffer) {
					console.warn(
						"Cannot play sound '" +
						id +
						"', since there is no added data named it."
					);
					return -1;
				}
				const soundNum = this.num++;

				const source = this.player.createBufferSource();
				source.setBuffer(buffer);
				const route = this.player.createRoute(source);
				const stereo = this.player.createStereoEffect();
				stereo.setPosition(position[0], position[1], position[2]);
				stereo.setOrientation(orientation[0], orientation[1], orientation[2]);
				route.addEffect([stereo, this.gain]);
				this.player.addRoute(`sounds.${soundNum}`, route);
				route.play();
				source.output.addEventListener("ended", () => {
					this.playing.delete(soundNum);
				});
				this.playing.add(soundNum);
				return soundNum;
			}

			/**
			 * 停止一个音效
			 * @param num 音效的唯一 id
			 */
			stop(num) {
				const id = `sounds.${num}`;
				const route = this.player.getRoute(id);
				if (route) {
					route.stop();
					this.player.removeRoute(id);
					this.playing.delete(num);
				}
			}

			/**
			 * 停止播放所有音效
			 */
			stopAllSounds() {
				this.playing.forEach((v) => {
					const id = `sounds.${v}`;
					const route = this.player.getRoute(id);
					if (route) {
						route.stop();
						this.player.removeRoute(id);
					}
				});
				this.playing.clear();
			}
		}
		const soundPlayer = new SoundPlayer(audioPlayer);

		function loadAllBgm() {
			const data = data_a1e2fb4a_e986_4524_b0da_9b7ba7c0874d;
			for (const bgm of data.main.bgms) {
				bgmController.addBgm(bgm);
			}
		}
		loadAllBgm();
		AudioDecoder.registerDecoder(AudioType.Ogg, VorbisDecoder);
		AudioDecoder.registerDecoder(AudioType.Opus, OpusDecoder);

		core.plugin.audioSystem = {
			AudioType,
			AudioDecoder,
			AudioStatus,
			checkAudioType,
			isAudioSupport,
			audioPlayer,
			soundPlayer,
			bgmController,
			guessTypeByExt,
			BgmController,
			SoundPlayer,
			EchoEffect,
			DelayEffect,
			ChannelVolumeEffect,
			VolumeEffect,
			StereoEffect,
			AudioEffect,
			AudioPlayer,
			AudioRoute,
			AudioStreamSource,
			AudioElementSource,
			AudioBufferSource,
			loadAllBgm,
			StreamLoader,
		};
		//bgm相关复写
		control.prototype.playBgm = (bgm, when) => {
			bgm = core.getMappedName(bgm);
			if (main.mode != "play" || !core.material.bgms[bgm]) return;
			// 如果不允许播放
			if (!core.musicStatus.bgmStatus) {
				try {
					core.musicStatus.playingBgm = bgm;
					core.musicStatus.lastBgm = bgm;
					core.material.bgms[bgm].pause();
				} catch (e) {
					console.error(e);
				}
				return;
			}
			core.setMusicBtn();

			try {
				bgmController.play(bgm, when);
			} catch (e) {
				console.log("无法播放BGM " + bgm);
				console.error(e);
				core.musicStatus.playingBgm = null;
			}

		};
		control.prototype.pauseBgm = () => {
			bgmController.pause();
			core.setMusicBtn();
		};

		control.prototype.resumeBgm = function () {
			bgmController.resume();
			core.setMusicBtn();
		};
		control.prototype.checkBgm = function () {
			core.playBgm(bgmController.playingBgm || main.startBgm);
		};
		control.prototype.triggerBgm = function () {
			core.musicStatus.bgmStatus = !core.musicStatus.bgmStatus;
			if (bgmController.playing) bgmController.pause();
			else bgmController.resume();
			core.setMusicBtn();
			core.setLocalStorage("bgmStatus", core.musicStatus.bgmStatus);
		};
		//sound相关复写
		control.prototype.playSound = function (
			sound,
			_pitch,
			callback,
			position,
			orientation
		) {
			if (main.mode != "play" || !core.musicStatus.soundStatus) return callback?.();
			const name = core.getMappedName(sound);
			const num = soundPlayer.play(name, position, orientation);
			const route = audioPlayer.getRoute(`sounds.${num}`);
			if (!route) {
				callback?.();
				return -1;
			} else {
				sleep(route.duration * 1000).then(() => callback?.());
				return num;
			}
		};
		control.prototype.stopSound = function (id) {
			if (isNil(id)) {
				soundPlayer.stopAllSounds();
			} else {
				soundPlayer.stop(id);
			}
		};
		control.prototype.getPlayingSounds = function () {
			return [...soundPlayer.playing];
		};
		//sound加载复写
		loader.prototype._loadOneSound_decodeData = function (name, data) {
			if (data instanceof Blob) {
				var blobReader = new zip.BlobReader(data);
				blobReader.init(function () {
					blobReader.readUint8Array(0, blobReader.size, function (uint8) {
						//core.loader._loadOneSound_decodeData(name, uint8.buffer);
						soundPlayer.add(name, uint8);
					});
				});
				return;
			}
			if (data instanceof ArrayBuffer) {
				const uint8 = new Uint8Array(data);
				soundPlayer.add(name, uint8);
			}
		};
		//音量控制复写
		soundPlayer.setVolume(
			core.musicStatus.userVolume * core.musicStatus.designVolume
		);
		bgmController.setVolume(
			core.musicStatus.userVolume * core.musicStatus.designVolume
		);
		actions.prototype._clickSwitchs_sounds_userVolume = function (delta) {
			var value = Math.round(Math.sqrt(100 * core.musicStatus.userVolume));
			if (value == 0 && delta < 0) return;
			core.musicStatus.userVolume = core.clamp(
				Math.pow(value + delta, 2) / 100,
				0,
				1
			);
			//audioContext 音效 不受designVolume 影响
			if (core.musicStatus.gainNode != null)
				core.musicStatus.gainNode.gain.value = core.musicStatus.userVolume;
			soundPlayer.setVolume(
				core.musicStatus.userVolume * core.musicStatus.designVolume
			);
			bgmController.setVolume(
				core.musicStatus.userVolume * core.musicStatus.designVolume
			);
			core.setLocalStorage("userVolume", core.musicStatus.userVolume);
			core.playSound("确定");
			core.ui._drawSwitchs_sounds();
		};
	},
	"platFly": function () {
		// 本插件可以给平面塔启用一个带小地图的楼传，默认关闭
		// 是否开启本插件，默认禁用；将此改成 true 将启用本插件。
		var __enable = false;
		if (!__enable) return;

		/* 第一步：复制到插件
		 * 第二步：将flag:usePlatFly改为true可将带地图的楼传启用
		 * 第三步：将flag:__useMinimap__设为true可开启小地图，该操作需切换楼层
		 * 修改小地图的缩放可以修改flag:userScale，默认为1
		 * 注意：楼层转换必须使用楼层坐标，而不是前一楼、后一楼
		 * 关于操作：上楼和下楼操作为PgUp和PgDn，后退10层和前进10层操作为,（<）和.（>）
		 * 注意：请尽量保证地图传送的地方物理位置正好对准（即把地图拼接上箭头位置恰好对齐）否则连线的位置可能不准
		 * 分区说明：用普通事件的楼层转换（红点）代替楼层转换（绿点）即可
		 * 说明：紫色表示目前可以到达却没有到达过的地图（所以这是一个具有探索性的地图插件）
		 */
		// 录像验证直接干掉这个插件
		if (main.replayChecking) return;
		// *** --- 以下数据为用户可修改数据 修改后不影响该插件的基本功能 --- *** //
		// 检测楼层转换的图块id
		var leftPortal = "leftPortal", // 左
			rightPortal = "rightPortal", // 右
			upPortal = "upPortal", // 上
			downPortal = "downPortal", // 下
			upFloor = "upFloor", // 上楼
			downFloor = "downFloor"; // 下楼
		// 一些常用默认值
		var defaultScale = 1, // 默认缩放比率
			defaultLoop = 5, // 绘制地图时的循环检测地图路线次数，loop为5说明最远的地图可以用6步到达
			defaultOpacity = 0.6, // 默认不透明度
			defaultMinorAlpha = defaultOpacity / 2; // 3D绘图时，不与当前层处于同一高度层的默认初始不透明度，不透明度会随着层数的增加或减少而减少
		// *** --- 用户修改区 END --- *** //
		//  其余可自定义内容均用 //***--- 包裹着

		/* -----------------------------------下面是一些调用案例
		 * 
		 * 如果想在状态栏显示可以在状态栏自绘里这么写：
		 core.drawFlyMap(ctx, 你想要的左上角横坐标, 你想要的左上角纵坐标, 你想要的宽度, 你想要的高度, core.status.floorId, {fromUser: true, opacity: 1, loop: 3, use3D:false});
		 * 
		 * -----------------------------------以下为高深区域，如果不必要可以不看
		 * 
		 * 主要函数说明（这几个函数异常强大，善用可以有弄一些有意思的东西，既然作者都说强大了，那就是特别强大）
		 * core.drawFlyMap(ctx : string, x?: number, y?: number, width?:number, height?:number, floorId?:string, config?:any): void
		 * 参数说明：
		 * ctx:画布，如果不存在则会新建x,y,width,height参数的画布
		 * x,y,width,height:画布不存在时创建该数据的画布，如果存在，那么在画布的x,y位置绘制宽度为width，高度为height的地图
		 * floorId:以该楼层为中心绘制
		 * config:配制参数，包括以下内容（该参数为对象）
		 * 	 fromUser:是否循环绘制（为false时只绘制一层，否则绘制5层）
		 * 	 oriFloor:这个不用管就好，具体原理比较复杂，不填或者和floorId一样就行
		 * 	 scale:缩放比率，这个是绝对比率，与画布大小无关，默认为1
		 * 	 interval:地图间的间距，默认为width / 24
		 * 	 deltaH:3D地图的纵向高度差，默认为绘制高度（height）/ 4
		 * 	 noErase:是否不清空画布再绘制，默认为false
		 * 	 fromMini:是否是在小地图上绘制时调用的（无自动缩放和自动定位）
		 * 	 loop:绘制层数，fromUser为true时才有用，默认为5
		 * 	 opacity:不透明度，默认为0.6
		 * 	 minorAlpha:3D地图的不与当前层在同一高度的楼层的初始不透明度，默认为opacity/2
		 * 	 layer:平面模式下绘制的楼层高度，当前所在层为0，上楼则+1，下楼则-1，默认为0，只有当use3D为false且可以绘制3D地图时有效
		 * 	 use3D:是否启用3D绘图，前提是所有地图不都在同一高度，默认为false
		 * 	 reLeft:3D重新定位画布的左位置，默认为-240
		 * 	 reTop:3D重新定位画布的上位置，默认为-240
		 * 	 clearCache:是否清除缓存重算，默认为false
		 * 	 map:这个是最强大的功能了，可以将自定义地图插入，以绘制自定义地图
		 * 	 自定义地图格式：{"left_0_7":"MT1", "right_2_7":"MT2"}以此类推也可以"left_0_7,right_3_7,up_1_0"这种套娃，使用的前提是指定位置得有相应方向的箭头，不然会出错，注意楼层id是到往的楼层的id，如果想绘制3D地图，可以这么写：{"top_1_3,left_0_7": "1_MT1"}，前面的1_必须写，上楼为top，下楼为bottom
		 * 	 默认取自floorId地图
		 * 如有疑问可在造塔群@古祠
		 * 
		 * core.getFlyMap(floorId?:string, fromUser?:boolean, oriFloor?:string, loop?:number):Object
		 * 参数说明:floorId:以该楼层为中心绘制
		 * fromUser:是否循环绘制（为false时只绘制一层，否则绘制5层）
		 * oriFloor:这个不用管就好，具体原理比较复杂，填null或者和floorId一样就行
		 * loop:绘制层数，fromUser为true时才有用，默认为5
		 */

		////// 绘制楼层传送器 //////
		var originDrawFly = core.ui.drawFly;
		ui.prototype.drawFly = function (page) {
			if (!flags.usePlatFly || core.isReplaying()) return originDrawFly.call(core.ui, page);
			core.status.event.data = page;
			var floorId = core.floorIds[page];
			core.clearMap('ui');
			core.setAlpha('ui', 0.85);
			core.fillRect('ui', 0, 0, this.PIXEL, this.PIXEL, '#000000');
			core.setAlpha('ui', 1);
			var size = this.PIXEL;
			//***--- 楼传绘制 可根据自己的需求更改 更改之后注意更改点击操作的函数
			// 背景
			core.drawThumbnail(floorId, null, { ctx: 'ui', x: 0, y: 0, size: size, damage: true, fromFly: true });
			core.fillRect("ui", 0, 65, 32, size - 130, [0, 0, 0, 0.7]);
			core.fillRect("ui", size, 65, -32, size - 130, [0, 0, 0, 0.7]);
			core.fillRect("ui", 65, 0, size / 2 - 114, 32, [0, 0, 0, 0.7]);
			core.fillRect("ui", 65, size, size / 2 - 114, -32, [0, 0, 0, 0.7]);
			core.fillRect("ui", size / 2 + 49, 0, size / 2 - 114, 32, [0, 0, 0, 0.7]);
			core.fillRect("ui", size / 2 + 49, size, size / 2 - 114, -32, [0, 0, 0, 0.7]);
			core.fillRect("ui", size / 2 - 47, 0, 94, 32, [0, 0, 0, 0.7]);
			core.fillRect("ui", size / 2 - 47, size, 94, -32, [0, 0, 0, 0.7]);
			core.fillRect("ui", 0, 0, 63, 32, [0, 0, 0, 0.7]);
			core.fillRect("ui", size, 0, -63, 32, [0, 0, 0, 0.7]);
			core.fillRect("ui", 0, 32, 32, 31, [0, 0, 0, 0.7]);
			core.fillRect("ui", 0, size - 32, 32, -31, [0, 0, 0, 0.7]);
			core.fillRect("ui", 0, size, 63, -32, [0, 0, 0, 0.7]);
			core.fillRect("ui", size, size, -63, -32, [0, 0, 0, 0.7]);
			core.fillRect("ui", size, size - 32, -32, -31, [0, 0, 0, 0.7]);
			core.fillRect("ui", size, 32, -32, 31, [0, 0, 0, 0.7]);
			core.setTextAlign("ui", "center");
			// 文字
			if (core.getFloorByDirection("left", floorId))
				core.fillText("ui", "←", 16, size / 2 + 10, core.hasVisitedFloor(core.getFloorByDirection("left",
					floorId)) ? "#ffffff" : "#ff22ff", "26px Verdana");
			if (core.getFloorByDirection("right", floorId))
				core.fillText("ui", "→", size - 16, size / 2 + 10, core.hasVisitedFloor(core.getFloorByDirection("right",
					floorId)) ? "#ffffff" : "#ff22ff", "26px Verdana");
			if (core.getFloorByDirection("up", floorId))
				core.fillText("ui", "↑", size / 2, 28, core.hasVisitedFloor(core.getFloorByDirection("up",
					floorId)) ? "#ffffff" : "#ff22ff", "26px Verdana");
			if (core.getFloorByDirection("down", floorId))
				core.fillText("ui", "↓", size / 2, size - 4, core.hasVisitedFloor(core.getFloorByDirection("down",
					floorId)) ? "#ffffff" : "#ff22ff", "26px Verdana");
			if (core.getFloorByDirection("top", floorId))
				core.fillText("ui", "上楼", size / 4 + 8, 24, core.hasVisitedFloor(core.getFloorByDirection("top",
					floorId)) ? "#ffffff" : "#ff22ff", "22px " + core.status.globalAttribute.font);
			if (core.getFloorByDirection("bottom", floorId))
				core.fillText("ui", "下楼", size / 4 * 3 - 8, 24, core.hasVisitedFloor(core.getFloorByDirection("bottom",
					floorId)) ? "#ffffff" : "#ff22ff", "22px " + core.status.globalAttribute.font);
			core.fillText("ui", "退10层", size / 4 + 8, size - 8, core.actions._getNextFlyFloor(-1) == page ? "#ff22ff" : "#ffffff",
				"22px " + core.status.globalAttribute.font);
			core.fillText("ui", "进10层", size / 4 * 3 - 8, size - 8, core.actions._getNextFlyFloor(1) == page ? "#ff22ff" : "#ffffff",
				"22px " + core.status.globalAttribute.font);
			core.fillText("ui", "退出", 32, 24, "#ffffff", "22px " + core.status.globalAttribute.font);
			core.fillText("ui", "楼层名", 32, size - 8, "#ffffff", "22px " + core.status.globalAttribute.font);
			core.fillText("ui", "（B）", 16, size - 40, "#ffffff", "22px " + core.status.globalAttribute.font);
			core.createCanvas("mapOnUi", -240, -240, size + 480, size + 480, 150);
			core.drawFlyMap("mapOnUi", 240, 240, size, size, floorId, { fromUser: true, oriFloor: floorId, use3D: flags.use3D });
			if (core.can3D(floorId) && !flags.in3D)
				core.fillText("ui", "3D模式", size - 32, 24, "#ffffff", "20px " + core.status.globalAttribute.font);
			if (flags.in3D)
				core.fillText("ui", "2D模式", size - 32, 24, "#ffffff", "20px " + core.status.globalAttribute.font);
			if (core.can3D(floorId)) core.fillText("ui", "（Z）", size - 16, 56, "#ffffff", "20px " + core.status.globalAttribute.font);
			if (flags.flyTitle) {
				var style = document.getElementById("ui").getContext("2d");
				style.shadowColor = "rgba(0, 0, 0, 1)";
				style.shadowBlur = 5;
				core.fillRect("ui", size / 4, size / 4, size / 2, size / 8, [180, 180, 180, 0.7]);
				core.strokeRect("ui", size / 4, size / 4, size / 2, size / 8, [255, 255, 255, 0.7], 3);
				style.shadowOffsetX = 4;
				style.shadowOffsetY = 2;
				core.fillText("ui", (core.status.maps[floorId] || {}).title, size / 2, size / 16 * 5 + 11, "#ffffff",
					"32px " + core.status.globalAttribute.font);
				style.shadowColor = "none";
				style.shadowBlur = 0;
				style.shadowOffsetX = 0;
				style.shadowOffsetY = 0;
			}
			//***--- 楼传绘制
		};
		////// 楼层传送器界面时的点击操作 //////
		var originClickFly = core.actions._clickFly;
		actions.prototype._clickFly = function (x, y) {
			if (!flags.usePlatFly || core.isReplaying()) return originClickFly.call(core.actions, x, y);
			var page = core.status.event.data;
			var floorId = core.floorIds[page];
			//***--- 点击操作 可以修改的地方只有x,y坐标 其余不可修改
			if (x <= 2 && y <= 1) {
				core.playSound('取消');
				core.deleteCanvas("mapOnUi")
				core.ui.closePanel();
				return;
			}
			// 3D模式
			if (x >= core.__SIZE__ - 2 && y <= 1) {
				if (core.can3D(floorId) && !flags.in3D)
					flags.use3D = true;
				if (flags.in3D) flags.use3D = false;
				core.playSound('光标移动');
				core.ui.drawFly(page);
				return;
			}
			// 显示名称
			if (x <= 1 && y >= core.__SIZE__ - 2) {
				if (flags.flyTitle) flags.flyTitle = false;
				else flags.flyTitle = true;
				core.playSound('光标移动');
				core.ui.drawFly(page);
				return;
			}
			// 飞过去
			if (x > 1 && x < core.__SIZE__ - 1 && y > 1 && y < core.__SIZE__ - 1) {
				if (core.status.maps[core.status.floorId].canFlyFrom &&
					core.status.maps[core.floorIds[core.status.event.data]].canFlyTo &&
					core.hasVisitedFloor(core.floorIds[core.status.event.data])) {
					core.deleteCanvas("mapOnUi");
				}
				core.flyTo(core.floorIds[core.status.event.data]);
			}
			// 前进10层 后退10层
			if (y > core.__SIZE__ - 2 && core.actions._getNextFlyFloor(-1) != page &&
				x >= 2 && x <= Math.floor(core.__SIZE__ / 2) - 2) {
				core.ui.drawFly(this._getNextFlyFloor(-10));
				core.playSound("光标移动");
			}
			if (y > core.__SIZE__ - 2 && core.actions._getNextFlyFloor(1) != page &&
				x >= Math.ceil(core.__SIZE__ / 2) + 1 && x <= core.__SIZE__ - 3) {
				core.ui.drawFly(this._getNextFlyFloor(10));
				core.playSound("光标移动");
			}
			// 获取索引
			function getId(direction) {
				var id = core.getFloorByDirection(direction, floorId);
				for (var i in core.floorIds) {
					if (core.floorIds[i] == id) return parseInt(i);
				}
			}
			// 上下左右和上下楼
			if (x < 1 && core.getFloorByDirection("left", floorId) &&
				core.hasVisitedFloor(core.getFloorByDirection("left", floorId)) && y >= 2 && y < core.__SIZE__ - 2) {
				core.playSound("光标移动");
				core.drawFly(getId("left"));
			}
			if (x > core.__SIZE__ - 2 && core.getFloorByDirection("right", floorId) &&
				core.hasVisitedFloor(core.getFloorByDirection("right", floorId)) && y >= 2 && y < core.__SIZE__ - 2) {
				core.playSound("光标移动");
				core.drawFly(getId("right"));
			}
			if (y < 1 && core.getFloorByDirection("up", floorId) &&
				core.hasVisitedFloor(core.getFloorByDirection("up", floorId)) &&
				x >= Math.floor(core.__SIZE__ / 2) - 1 && x <= Math.ceil(core.__SIZE__ / 2)) {
				core.playSound("光标移动");
				core.drawFly(getId("up"));
			}
			if (y > core.__SIZE__ - 2 && core.getFloorByDirection("down", floorId) &&
				core.hasVisitedFloor(core.getFloorByDirection("down", floorId)) &&
				x >= Math.floor(core.__SIZE__ / 2) - 1 && x <= Math.ceil(core.__SIZE__ / 2)) {
				core.playSound("光标移动");
				core.drawFly(getId("down"));
			}
			if (y < 1 && x >= 2 && x <= Math.floor(core.__SIZE__ / 2) - 2 &&
				core.getFloorByDirection("top", floorId) && core.hasVisitedFloor(core.getFloorByDirection("top", floorId))) {
				core.playSound("光标移动");
				core.drawFly(getId("top"));
			}
			if (y < 1 && x >= Math.ceil(core.__SIZE__ / 2) + 1 && x <= core.__SIZE__ - 3 &&
				core.getFloorByDirection("bottom", floorId) && core.hasVisitedFloor(core.getFloorByDirection("bottom", floorId))) {
				core.playSound("光标移动");
				core.drawFly(getId("bottom"));
			}
			return;
			//***--- 点击操作
		};
		////// 楼层传送器界面时，按下某个键的操作 //////
		var originKeyDownFly = core.actions._keyDownFly;
		actions.prototype._keyDownFly = function (keycode) {
			if (!flags.usePlatFly || core.isReplaying()) return originKeyDownFly.call(core.actions, keycode);
			var page = core.status.event.data;
			var floorId = core.floorIds[page];
			// 获取索引
			function getId(direction) {
				var id = core.getFloorByDirection(direction, floorId);
				for (var i in core.floorIds) {
					if (core.floorIds[i] == id) return parseInt(i);
				}
			}
			//***--- 按键操作 只可以修改按键的keycode
			if (keycode == 37 && core.getFloorByDirection("left", floorId) &&
				core.hasVisitedFloor(core.getFloorByDirection("left", floorId))) {
				core.playSound('光标移动');
				core.ui.drawFly(getId("left"));
			} else if (keycode == 38 && core.getFloorByDirection("up", floorId) &&
				core.hasVisitedFloor(core.getFloorByDirection("up", floorId))) {
				core.playSound('光标移动');
				core.ui.drawFly(getId("up"));
			} else if (keycode == 39 && core.getFloorByDirection("right", floorId) &&
				core.hasVisitedFloor(core.getFloorByDirection("right", floorId))) {
				core.playSound('光标移动');
				core.ui.drawFly(getId("right"));
			} else if (keycode == 40 && core.getFloorByDirection("down", floorId) &&
				core.hasVisitedFloor(core.getFloorByDirection("down", floorId))) {
				core.playSound('光标移动');
				core.ui.drawFly(getId("down"));
			} else if (keycode == 33 && core.getFloorByDirection("top", floorId) &&
				core.hasVisitedFloor(core.getFloorByDirection("top", floorId))) {
				core.playSound('光标移动');
				core.ui.drawFly(getId("top"));
			} else if (keycode == 34 && core.getFloorByDirection("bottom", floorId) &&
				core.hasVisitedFloor(core.getFloorByDirection("bottom", floorId))) {
				core.playSound('光标移动');
				core.ui.drawFly(getId("bottom"));
			} else if (keycode == 90) {
				if (core.can3D(floorId) && !flags.in3D)
					flags.use3D = true;
				if (flags.in3D) flags.use3D = false;
				core.playSound('光标移动');
				core.ui.drawFly(page);
			} else if (keycode == 66) { // 地图名
				if (flags.flyTitle) flags.flyTitle = false;
				else flags.flyTitle = true;
				core.playSound('光标移动');
				core.ui.drawFly(page);
			} else if (keycode == 188 && core.actions._getNextFlyFloor(-1) != page) { // 退10层
				core.ui.drawFly(this._getNextFlyFloor(-10));
				core.playSound("光标移动");
			} else if (keycode == 190 && core.actions._getNextFlyFloor(1) != page) { // 进10层
				core.ui.drawFly(this._getNextFlyFloor(10));
				core.playSound("光标移动");
			}
			return;
			//***--- 按键操作
		};
		////// 楼层传送器界面时，放开某个键的操作 //////
		var originKeyUpFly = core.actions._keyUpFly;
		actions.prototype._keyUpFly = function (keycode) {
			if (!flags.usePlatFly || core.isReplaying()) return originKeyUpFly.call(core.actions, keycode);
			if (keycode == 71 || keycode == 27 || keycode == 88) {
				core.playSound('取消');
				core.deleteCanvas("mapOnUi");
				core.ui.closePanel();
			}
			if (keycode == 13 || keycode == 32 || keycode == 67)
				this._clickFly(this.HSIZE - 1, this.HSIZE - 1);
			return;
		};
		////// 点击楼层传送器时的打开操作 //////
		events.prototype.useFly = function (fromUserAction) {
			if (core.isReplaying()) return;

			// 从“浏览地图”页面：尝试直接传送到该层
			if (core.status.event.id == 'viewMaps') {
				if (!core.hasItem('fly')) {
					core.playSound('操作失败');
					core.drawTip('你没有' + core.material.items['fly'].name, 'fly');
				} else if (!core.canUseItem('fly')) {
					core.playSound('操作失败');
					core.drawTip('无法传送到当前层', 'fly');
				} else {
					core.flyTo(core.status.event.data.floorId);
				}
				return;
			}
			if (!this._checkStatus('fly', fromUserAction, true)) {
				core.deleteCanvas('mapOnUi');
				return;
			}
			if (core.flags.flyNearStair && !core.nearStair()) {
				core.playSound('操作失败');
				core.drawTip("只有在楼梯边才能使用" + core.material.items['fly'].name, 'fly');
				core.unlockControl();
				core.status.event.data = null;
				core.status.event.id = null;
				return;
			}
			if (!core.canUseItem('fly')) {
				core.playSound('操作失败');
				core.drawTip(core.material.items['fly'].name + "好像失效了", 'fly');
				core.unlockControl();
				core.status.event.data = null;
				core.status.event.id = null;
				return;
			}
			core.playSound('打开界面');
			core.useItem('fly', true);
			return;
		};
		// 获取区域平面地图
		this.getFlyMap = function (floorId, fromUser, oriFloor, loop, clearCache) {
			floorId = floorId || core.status.floorId;
			if (floorId == oriFloor && !fromUser) return;
			oriFloor = oriFloor || core.status.floorId;
			if (!floorId) return;
			// 判断是否需要缓存
			function needCache(fromUser) {
				if (fromUser && !core.status.flyMap[floorId]) return true;
				if (!fromUser && !core.status.flyMap.cache[floorId]) return true;
				return false;
			}
			// 缓存，加快运行速率
			if (!core.status.flyMap) core.status.flyMap = {};
			if (!core.status.flyMap.cache) core.status.flyMap.cache = {};
			if (!core.status.layer) core.status.layer = {};
			if (!core.status.layer[floorId]) core.status.layer[floorId] = {};
			if (core.status.flyMap.cache[floorId] && fromUser) delete core.status.flyMap.cache[floorId]
			if (core.status.flyMap[floorId] && !fromUser) delete core.status.flyMap[floorId]
			if (needCache(fromUser) || clearCache) {
				// 初始化
				core.status.flyMap[floorId] = {};
				core.status.flyMap[floorId].thisMap = {};
				core.extractBlocks(floorId);
				core.status.maps[floorId].blocks.forEach(function (block) {
					var id = block.event.id;
					var x = block.x,
						y = block.y;
					var trigger = block.event.trigger;
					if (trigger != "changeFloor" && trigger != "upFloor" && trigger != "downFloor") return;
					// 是箭头且可以切换地图
					var toFloor = block.event.data.floorId;
					// 加入相应位置
					// 箭头
					if (id == leftPortal) {
						core.status.flyMap[floorId].thisMap["left_" + x + "_" + y] = toFloor;
					}
					if (id == upPortal) {
						core.status.flyMap[floorId].thisMap["up_" + x + "_" + y] = toFloor;
					}
					if (id == rightPortal) {
						core.status.flyMap[floorId].thisMap["right_" + x + "_" + y] = toFloor;
					}
					if (id == downPortal) {
						core.status.flyMap[floorId].thisMap["down_" + x + "_" + y] = toFloor;
					}
					// 上下楼
					if (id == upFloor) {
						core.status.flyMap[floorId].thisMap["top_" + x + "_" + y] = toFloor;
						core.status.layer[floorId].top = true;
					}
					if (id == downFloor) {
						core.status.flyMap[floorId].thisMap["bottom_" + x + "_" + y] = toFloor;
						core.status.layer[floorId].bottom = true;
					}
				});
				// 把下几层接着检测出来
				if (fromUser) {
					var usedId = {};
					for (var c = 1; c <= loop; c++) {
						for (var i in core.status.flyMap[floorId].thisMap) {
							var link = core.status.flyMap[floorId].thisMap;
							if (!core.hasVisitedFloor(link[i]) || link[i] instanceof Object || usedId[link[i]]) continue;
							usedId[link[i]] = true;
							var next = core.getFlyMap(link[i], false, oriFloor);
							for (var to in next) {
								if (!core.status.layer[next[to]]) core.status.layer[next[to]] = {};
								core.status.flyMap[floorId].thisMap[i + ',' + to] = next[to];
							}
						}
					}
				}
				// 把先上再下之类的去掉
				if (fromUser) {
					for (var i in core.status.flyMap[floorId].thisMap) {
						var route = i.split(",");
						for (var one = 0; one <= route.length - 2; one++) {
							var step = route[one],
								next = route[one + 1];
							if ((step.startsWith("up") && next.startsWith("down")) ||
								(step.startsWith("down") && next.startsWith("up")) ||
								(step.startsWith("left") && next.startsWith("right")) ||
								(step.startsWith("right") && next.startsWith("left")) ||
								(step.startsWith("top") && next.startsWith("bottom")) ||
								(step.startsWith("bottom") && next.startsWith("top"))) {
								delete core.status.flyMap[floorId].thisMap[i];
							}
						}
					}
				}
				// 非当前层不能存此类缓存
				if (!fromUser) {
					core.status.flyMap.cache = {};
					core.status.flyMap.cache[floorId] = {};
					core.status.flyMap.cache[floorId].thisMap = core.status.flyMap[floorId].thisMap;
					delete core.status.flyMap[floorId];
				}
				return fromUser ? core.status.flyMap[floorId].thisMap : core.status.flyMap.cache[floorId].thisMap;
			} else { // 直接使用缓存
				return fromUser ? core.status.flyMap[floorId].thisMap : core.status.flyMap.cache[floorId].thisMap;
			}
		};
		this.can3D = function (floorId) {
			var map = core.getFlyMap(floorId, true, floorId);
			for (var route in map) {
				if (route.indexOf("top") >= 0 || route.indexOf("bottom") >= 0)
					return true;
			}
			return false;
		};
		// 绘制地图
		this.drawFlyMap = function (ctx, x, y, width, height, floorId, config) {
			// 初始化配置项
			//***--- 初始化 可以修改 || 后的默认值 参数说明在开头的高深区域中
			var fromUser = config.fromUser || false,
				oriFloor = config.oriFloor || core.status.floorId,
				scale = config.scale || null,
				interval = config.interval || (width / 24),
				noErase = config.noErase || false,
				fromMini = config.fromMini || false,
				loop = config.loop || defaultLoop,
				opacity = config.opacity || defaultOpacity,
				layer = config.layer || 0,
				use3D = config.use3D || false,
				clearCache = config.clearCache || false,
				map = config.map || null;
			//***--- 初始化
			map = map || core.getFlyMap(floorId, fromUser, oriFloor, loop, clearCache);
			floorId = floorId || core.status.floorId;
			if (!floorId) return;
			// 检测是否需要3D绘图
			if (!fromMini && use3D) {
				for (var route in map) {
					if (route.indexOf("top") >= 0 || route.indexOf("bottom") >= 0) {
						config.map = map;
						return core.draw3DFlyMap(ctx, x, y, width, height, floorId, config);
					}
				}
			}
			if (layer != 0 && !use3D) {
				var canLayer = false
				for (var route in map) {
					if (route.indexOf("top") >= 0 || route.indexOf("bottom") >= 0) {
						canLayer = true;
						break;
					}
				}
				if (!canLayer) layer = 0;
			}
			flags.in3D = false;
			// 初始化
			var userScale = true;
			var newCreate = false;
			if (!scale) {
				userScale = false;
				scale = scale || defaultScale;
			}
			if (!core.dymCanvas[ctx]) {
				core.createCanvas(ctx, x, y, width, height, 140);
				newCreate = true;
			}
			x = x || 0;
			y = y || 0;
			// 获得canvas属性
			width = width || document.getElementById(ctx).width;
			height = height || document.getElementById(ctx).height;
			var oLeft = document.getElementById(ctx).offsetLeft / core.domStyle.scale,
				oTop = document.getElementById(ctx).offsetTop / core.domStyle.scale;
			// 重置大地图和楼传地图的canvas位置
			if (ctx == "mapOnUi") core.relocateCanvas("mapOnUi", -240, -240);
			if (!noErase)
				core.clearMap(ctx);
			var horCenter = Math.floor(width / 2),
				uprCenter = Math.floor(height / 2);
			if (!newCreate) {
				horCenter += x;
				uprCenter += y;
			}
			var centerX = horCenter,
				centerY = uprCenter;
			var left = centerX,
				right = centerX,
				up = centerY,
				down = centerY;
			var used = {};
			var haveLayer = {};
			var nx = horCenter,
				ny = uprCenter;
			// 先把所在楼层绘制了
			if (layer == 0) {
				var nw = core.status.maps[floorId].width * 2 * scale,
					nh = core.status.maps[floorId].height * 2 * scale;
				core.setAlpha(ctx, 1);
				core.fillRect(ctx, centerX - nw / 2, centerY - nh / 2, nw, nh, "#000000");
				core.strokeRect(ctx, centerX - nw / 2, centerY - nh / 2, nw, nh, "#ffff22", 3 * scale);
				// 当前层上下楼显示
				if (!haveLayer[floorId]) {
					core.setAlpha(ctx, 1);
					var needLayer = core.status.layer[floorId];
					if (needLayer.top && needLayer.bottom) {
						core.drawIcon(ctx, "upFloor", centerX - core.__SIZE__ * scale,
							centerY - core.__SIZE__ * scale, core.__SIZE__ * scale, core.__SIZE__ * scale);
						core.drawIcon(ctx, "downFloor", centerX - nw / 2 + core.__SIZE__ * scale,
							centerY - nh / 2 + core.__SIZE__ * scale, core.__SIZE__ * scale, core.__SIZE__ * scale);
					}
					if (needLayer.top && !needLayer.bottom) {
						core.drawIcon(ctx, "upFloor", centerX - Math.min(nw, nh) / 2, centerY - Math.min(nw, nh) / 2,
							Math.min(nw, nh), Math.min(nw, nh));
					}
					if (!needLayer.top && needLayer.bottom) {
						core.drawIcon(ctx, "downFloor", centerX - Math.min(nw, nh) / 2, centerY - Math.min(nw, nh) / 2,
							Math.min(nw, nh), Math.min(nw, nh));
					}
					haveLayer[floorId] = true;
				}
				// 四侧最远位置
				if (left > centerX - nw / 2) left = centerX - nw / 2;
				if (right < centerX + nw / 2) right = centerX + nw / 2;
				if (down < centerY + nh / 2) down = centerY + nh / 2;
				if (up > centerY - nh / 2) up = centerY - nh / 2;
			}
			core.setAlpha(ctx, opacity);
			for (var route in map) { // 绘制楼层和线条
				var rouArr = route.split(",");
				// 检索路线及画线
				// 初始化
				centerX = nx;
				centerY = ny;
				var nowFloor = floorId || core.status.floorId;
				var nowLayer = 0;
				for (var one in rouArr) { // 一个一个检测
					var step = rouArr[one].split("_");
					var cx = step[1],
						cy = step[2];
					// 获得当前图块
					core.getMapBlocksObj(nowFloor, true);
					var nowBlock = core.status.mapBlockObjs[nowFloor][cx + ',' + cy];
					if (!nowBlock) continue;
					var toLoc = nowBlock.event.data.loc,
						toFloor = nowBlock.event.data.floorId;
					var needLayer = core.status.layer[toFloor];
					// 当前层宽度和高度
					var nw = core.status.maps[nowFloor].width * 2 * scale,
						nh = core.status.maps[nowFloor].height * 2 * scale;
					// 目标层宽度和高度
					var tw = core.status.maps[toFloor].width * 2 * scale,
						th = core.status.maps[toFloor].height * 2 * scale;
					// 将当前层变为toFloor
					nowFloor = toFloor;
					// 超范围不画
					if ((centerX > oLeft + x + width || centerX < oLeft + x || centerY > oTop + y + height ||
						centerY < oTop + y) && userScale && !fromMini && ctx != "mapOnUi") continue;
					// 绘制toFloor层
					core.setAlpha(ctx, opacity);
					// 确定center 根据箭头自适配 同时绘制线条 我已经看不懂了
					if (!use3D && (step[0] == "top" || step[0] == "bottom") && layer == 0) break;
					if (step[0] == "top") nowLayer++;
					if (step[0] == "bottom") nowLayer--;
					if (step[0] == 'left') {
						var shouldTo = th / 2,
							realTo = toLoc[1] * 2 * scale;
						var shouldFrom = nh / 2,
							realFrom = step[2] * 2 * scale;
						if (nowLayer == layer) {
							core.drawLine(ctx, centerX - nw / 2, centerY + realFrom - shouldFrom,
								centerX - nw / 2 - interval, centerY + realFrom - shouldFrom, "#ffffff", 5 * scale);
							core.drawLine(ctx, centerX - nw / 2, centerY + realFrom - shouldFrom,
								centerX - nw / 2 - interval, centerY + realFrom - shouldFrom, "#000000", 2 * scale);
						}
						centerX -= nw / 2 + tw / 2 + interval;
						centerY += shouldTo - realTo + realFrom - shouldFrom;
					}
					if (step[0] == 'right') {
						var shouldTo = th / 2,
							realTo = toLoc[1] * 2 * scale;
						var shouldFrom = nh / 2,
							realFrom = step[2] * 2 * scale;
						if (nowLayer == layer) {
							core.drawLine(ctx, centerX + nw / 2, centerY + realFrom - shouldFrom,
								centerX + nw / 2 + interval, centerY + realFrom - shouldFrom, "#ffffff", 5 * scale);
							core.drawLine(ctx, centerX + nw / 2, centerY + realFrom - shouldFrom,
								centerX + nw / 2 + interval, centerY + realFrom - shouldFrom, "#000000", 2 * scale);
						}
						centerX += nw / 2 + tw / 2 + interval;
						centerY += shouldTo - realTo + realFrom - shouldFrom;
					}
					if (step[0] == 'up') {
						var shouldTo = tw / 2,
							realTo = toLoc[0] * 2 * scale;
						var shouldFrom = nw / 2,
							realFrom = step[1] * 2 * scale;
						if (nowLayer == layer) {
							core.drawLine(ctx, centerX + realFrom - shouldFrom, centerY - nh / 2,
								centerX + realFrom - shouldFrom, centerY - nh / 2 - interval, "#ffffff", 5 * scale);
							core.drawLine(ctx, centerX + realFrom - shouldFrom, centerY - nh / 2,
								centerX + realFrom - shouldFrom, centerY - nh / 2 - interval, "#000000", 2 * scale);
						}
						centerY -= nh / 2 + th / 2 + interval;
						centerX += shouldTo - realTo + realFrom - shouldFrom;
					}
					if (step[0] == 'down') {
						var shouldTo = tw / 2,
							realTo = toLoc[0] * 2 * scale;
						var shouldFrom = nw / 2,
							realFrom = step[1] * 2 * scale;
						if (nowLayer == layer) {
							core.drawLine(ctx, centerX + realFrom - shouldFrom, centerY + nh / 2,
								centerX + realFrom - shouldFrom, centerY + nh / 2 + interval, "#ffffff", 5 * scale);
							core.drawLine(ctx, centerX + realFrom - shouldFrom, centerY + nh / 2,
								centerX + realFrom - shouldFrom, centerY + nh / 2 + interval, "#000000", 2 * scale);
						}
						centerY += nh / 2 + th / 2 + interval;
						centerX += shouldTo - realTo + realFrom - shouldFrom;
					}
					// 只有和目标层高度相同时才绘制
					if (nowLayer != layer) continue;
					// 超范围的不画
					if ((centerX > oLeft + x + width || centerX < oLeft + x || centerY > oTop + y + height ||
						centerY < oTop + y) && userScale && !fromMini && ctx != "mapOnUi") continue;
					// 四侧最远位置
					if (left > centerX - tw / 2) left = centerX - tw / 2;
					if (right < centerX + tw / 2) right = centerX + tw / 2;
					if (down < centerY + th / 2) down = centerY + th / 2;
					if (up > centerY - th / 2) up = centerY - th / 2;
					// 画过了不画
					if (used[toFloor]) continue;
					used[toFloor] = true;
					// 画地图格
					if (core.hasVisitedFloor(toFloor)) {
						core.fillRect(ctx, centerX - tw / 2, centerY - th / 2, tw, th, "#000000");
						core.strokeRect(ctx, centerX - tw / 2, centerY - th / 2, tw, th, "#ffffff", 3 * scale);
					} else {
						core.fillRect(ctx, centerX - tw / 2, centerY - th / 2, tw, th, "#ff22ff");
						core.strokeRect(ctx, centerX - tw / 2, centerY - th / 2, tw, th, "#ffffff", 3 * scale);
						break;
					}
					// 上下楼显示
					if (haveLayer[toFloor]) continue;
					core.setAlpha(ctx, opacity);
					if (needLayer.top && needLayer.bottom) {
						core.drawIcon(ctx, "upFloor", centerX - core.__SIZE__ * scale,
							centerY - core.__SIZE__ * scale, core.__SIZE__ * scale, core.__SIZE__ * scale);
						core.drawIcon(ctx, "downFloor", centerX - tw / 2 + core.__SIZE__ * scale,
							centerY - th / 2 + core.__SIZE__ * scale, core.__SIZE__ * scale, core.__SIZE__ * scale);
					}
					if (needLayer.top && !needLayer.bottom) {
						core.drawIcon(ctx, "upFloor", centerX - Math.min(tw, th) / 2, centerY - Math.min(tw, th) / 2,
							Math.min(tw, th), Math.min(tw, th));
					}
					if (!needLayer.top && needLayer.bottom) {
						core.drawIcon(ctx, "downFloor", centerX - Math.min(tw, th) / 2, centerY - Math.min(tw, th) / 2,
							Math.min(tw, th), Math.min(tw, th));
					}
					haveLayer[toFloor] = true;
				}
			}
			// 自动缩放
			if ((right - left > core.__PIXELS__ - 64 || down - up > core.__PIXELS__ - 64) && !userScale && !fromMini) {
				scale = 1 / (Math.max(right - left, down - up) / (core.__PIXELS__ - 64));
				var con = { fromUser: fromUser, oriFloor: oriFloor, scale: scale, interval: interval * scale, layer: layer, opacity: opacity, loop: loop };
				return core.drawFlyMap(ctx, x, y, width, height, floorId, con);
			}
			// 大地图和楼层地图自适配定位
			if (ctx == "mapOnUi" && !fromMini && (left - nx < -128 || right - nx > 128 ||
				up - ny < -128 || down - ny > 128)) {
				core.relocateCanvas("mapOnUi", -240 + (-left - right + 2 * nx) / 2, -240 + (-up - down + 2 * ny) / 2);
			}
		};
		// 3D绘图
		this.draw3DFlyMap = function (ctx, x, y, width, height, floorId, config) {
			// 初始化配置项
			//***--- 初始化 同上一个初始化
			var fromUser = config.fromUser || false,
				oriFloor = config.oriFloor || core.status.floorId,
				scale = config.scale || null,
				interval = config.interval || (width / 24),
				deltaH = config.deltaH || (height / 8),
				noErase = config.noErase || false,
				fromMini = config.fromMini || false,
				loop = config.loop || defaultLoop,
				opacity = config.opacity || defaultOpacity,
				minorAlpha = config.minorAlpha || defaultMinorAlpha,
				reLeft = config.reLeft || -240,
				reTop = config.reTop || -240,
				clearCache = config.clearCache || false,
				map = config.map || null;
			//***--- 初始化
			map = map || core.getFlyMap(floorId, fromUser, oriFloor, loop, clearCache);
			// 当前层是否一个人在一层
			var alone = true;
			for (var route in map) {
				if (route.startsWith("left") || route.startsWith("right") ||
					route.startsWith("up") || route.startsWith("down")) {
					alone = false;
					break;
				}
			}
			// 是则增加一个先上再下的路径
			if (alone) {
				for (var route in map) {
					if (route.startsWith("top")) {
						var first = route.split(",")[0].split("_");
						break;
					}
				}
				var success = false;
				core.getMapBlocksObj(nowFloor, true);
				var nowBlock = core.status.mapBlockObjs[floorId][first[1] + "," + first[2]];
				var toFloor = nowBlock.event.data.floorId;
				core.extractBlocks(toFloor);
				core.status.maps[toFloor].blocks.forEach(function (block) {
					var id = block.event.id;
					var x = block.x,
						y = block.y;
					var trigger = block.event.trigger;
					if (trigger != "changeFloor") return;
					if (id == "downFloor") {
						map["top_" + first[1] + "_" + first[2] + "," + "bottom_" + x + "_" + y] = floorId;
						success = true;
						return;
					}
				});
				// 添加先上再下失败 尝试先下再上
				if (!success) {
					for (var route in map) {
						if (route.startsWith("bottom")) {
							var first = route.split(",")[0].split("_");
							break;
						}
					}
					var nowBlock = core.status.mapBlockObjs[floorId][first[1] + "," + first[2]];
					var toFloor = nowBlock.event.data.floorId;
					core.extractBlocks(toFloor);
					core.status.maps[toFloor].blocks.forEach(function (block) {
						var id = block.event.id;
						var x = block.x,
							y = block.y;
						var trigger = block.event.trigger;
						if (trigger != "changeFloor") return;
						if (id == "upFloor") {
							map["bottom_" + first[1] + "_" + first[2] + "," + "top_" + x + "_" + y] = floorId;
							success = true;
							return;
						}
					});
				}
			}
			floorId = floorId || core.status.floorId;
			if (!floorId) return;
			flags.in3D = true;
			// 初始化
			// 获得排序过的楼层路径
			map = core.sortFloor(map);
			map = map.map;
			var userScale = true;
			var newCreate = false;
			if (!scale) {
				userScale = false;
				scale = scale || defaultScale;
			}
			if (!core.dymCanvas[ctx]) {
				core.createCanvas(ctx, x, y, width, height, 140);
				newCreate = true;
			}
			x = x || 0;
			y = y || 0;
			// 获得canvas属性
			width = width || document.getElementById(ctx).width;
			height = height || document.getElementById(ctx).height;
			// 重置canvas位置
			core.relocateCanvas(ctx, reLeft, reTop);
			if (!noErase)
				core.clearMap(ctx);
			var horCenter = Math.floor(width / 2),
				uprCenter = Math.floor(height / 2);
			if (!newCreate) {
				horCenter += x;
				uprCenter += y;
			}
			// 单元格的中心点 即水平线中点处
			var centerX = horCenter,
				centerY = uprCenter;
			var left = centerX,
				right = centerX,
				up = centerY,
				down = centerY;
			var used = {};
			var nx = horCenter,
				ny = uprCenter;
			// 开始绘制
			for (var i = 0; i < map.length; i++) {
				var route = map[i][0];
				var nowLayer = map[i][1];
				var everyLayer = 0;
				route = route.split(",");
				// 每条路线初始化
				centerX = horCenter;
				centerY = uprCenter;
				centerX += core.status.maps[floorId].height * scale * Math.SQRT2 / 4;
				if (flags.viewingLayer) {
					centerY += deltaH * flags.viewingLayer;
				}
				var nowFloor = floorId || core.status.floorId;
				for (var one = 0; one < route.length; one++) {
					var step = route[one].split("_");
					var cx = step[1],
						cy = step[2];
					// 检测高度，是否与nowLayer一致 不一致在处理完center以后不绘制
					if (step[0] == "top") everyLayer++;
					if (step[0] == "bottom") everyLayer--;
					// 获得当前图块
					core.getMapBlocksObj(nowFloor, true);
					var nowBlock = core.status.mapBlockObjs[nowFloor][cx + ',' + cy];
					if (!nowBlock) continue;
					var toLoc = nowBlock.event.data.loc,
						toFloor = nowBlock.event.data.floorId;
					// 当前层宽度和高度
					// 斜二测画法
					var nw = core.status.maps[nowFloor].width * 2 * scale,
						nh = core.status.maps[nowFloor].height * scale * Math.SQRT2 / 2;
					// 目标层宽度和高度
					var tw = core.status.maps[toFloor].width * 2 * scale,
						th = core.status.maps[toFloor].height * scale * Math.SQRT2 / 2;
					if (!(toLoc instanceof Array)) {
						toLoc = [Math.floor(tw / 4 / scale), Math.floor(th / 4 / scale)];
					}
					// 绘制当前层
					if (nowLayer == 0 && !used[floorId]) {
						core.setAlpha(ctx, 1);
						used[floorId] = true;
						var nowW = core.status.maps[floorId].width * 2 * scale;
						var nowH = core.status.maps[floorId].height * scale * Math.SQRT2 / 2;
						var nodes = [
							[centerX - nowW / 2 - nowH / 2, centerY + nowH / 2],
							[centerX + nowW / 2 - nowH / 2, centerY + nowH / 2],
							[centerX + nowW / 2 + nowH / 2, centerY - nowH / 2],
							[centerX - nowW / 2 + nowH / 2, centerY - nowH / 2]
						];
						core.fillPolygon(ctx, nodes, "#000000");
						core.strokePolygon(ctx, nodes, "#ffff22", 1.5 * scale);
						// 四侧最远位置
						if (left > centerX - nw / 2 - nh / 2 && nowLayer == (flags.viewingLayer || 0)) left = centerX - nw / 2 - nh / 2;
						if (right < centerX + nw / 2 + nh / 2 && nowLayer == (flags.viewingLayer || 0)) right = centerX + nw / 2 + nh / 2;
					}
					// 将当前层变为toFloor
					var fromFloor = nowFloor;
					nowFloor = toFloor;
					// 计算center 画同层间的线 我已经看不懂了
					// 设置不透明度
					if (nowLayer == (flags.viewingLayer || 0)) {
						core.setAlpha(ctx, opacity);
					} else {
						core.setAlpha(ctx, minorAlpha * Math.max(0, 1 - 0.34 * Math.abs(nowLayer - (flags.viewingLayer || 0))));
					}
					if (step[0] == "left") {
						var shouldFrom = nh / 2,
							realFrom = cy * scale * Math.SQRT2 / 2;
						var shouldTo = th / 2,
							realTo = toLoc[1] * scale * Math.SQRT2 / 2;
						if (everyLayer == nowLayer && !used[fromFloor + "_" + toFloor + "_" + cx + "_" + cy])
							core.drawLine(ctx, centerX - nw / 2 + nh / 2 - realFrom, centerY + realFrom - shouldFrom,
								centerX - nw / 2 - interval + nh / 2 - realFrom, centerY + realFrom - shouldFrom, "#ffffff", 2 * scale);
						centerX -= nw / 2 + tw / 2 + interval + shouldTo - realTo + realFrom - shouldFrom;
						centerY += shouldTo - realTo + realFrom - shouldFrom;
					}
					if (step[0] == "right") {
						var shouldFrom = nh / 2,
							realFrom = cy * scale * Math.SQRT2 / 2;
						var shouldTo = th / 2,
							realTo = toLoc[1] * scale * Math.SQRT2 / 2;
						if (nowLayer == everyLayer && !used[fromFloor + "_" + toFloor + "_" + cx + "_" + cy])
							core.drawLine(ctx, centerX + nw / 2 + nh / 2 - realFrom, centerY + realFrom - shouldFrom,
								centerX + nw / 2 + interval + nh / 2 - realFrom, centerY + realFrom - shouldFrom, "#ffffff", 2 * scale);
						centerX += nw / 2 + tw / 2 + interval - (shouldTo - realTo + realFrom - shouldFrom);
						centerY += shouldTo - realTo + realFrom - shouldFrom;
					}
					if (step[0] == "up") {
						var shouldTo = tw / 2,
							realTo = toLoc[0] * scale * 2;
						var shouldFrom = nw / 2,
							realFrom = cx * scale * 2;
						if (nowLayer == everyLayer && !used[fromFloor + "_" + toFloor + "_" + cx + "_" + cy])
							core.drawLine(ctx, centerX + realFrom - shouldFrom + nh / 2, centerY - nh / 2, centerX + realFrom -
								shouldFrom + interval * Math.SQRT2 / 4 + nh / 2, centerY - nh / 2 - interval * Math.SQRT2 / 4, "#ffffff", 2 * scale);
						centerY -= nh / 2 + th / 2 + interval * Math.SQRT2 / 4;
						centerX += shouldTo - realTo + realFrom - shouldFrom + (nh / 2 + th / 2 + interval * Math.SQRT2 / 4);
					}
					if (step[0] == "down") {
						var shouldTo = tw / 2,
							realTo = toLoc[0] * scale * 2;
						var shouldFrom = nw / 2,
							realFrom = cx * scale * 2;
						if (nowLayer == everyLayer && !used[fromFloor + "_" + toFloor + "_" + cx + "_" + cy])
							core.drawLine(ctx, centerX + realFrom - shouldFrom - nh / 2, centerY + nh / 2, centerX + realFrom -
								shouldFrom - interval * Math.SQRT2 / 4 - nh / 2, centerY + nh / 2 + interval * Math.SQRT2 / 4, "#ffffff", 2 * scale);
						centerY += nh / 2 + th / 2 + interval * Math.SQRT2 / 4;
						centerX += shouldTo - realTo + realFrom - shouldFrom - (nh / 2 + th / 2 + interval * Math.SQRT2 / 4);
					}
					if (step[0] == "top") {
						centerY -= deltaH;
					}
					if (step[0] == "bottom") {
						centerY += deltaH;
					}
					if (everyLayer == nowLayer && step[0] != "top" && step[0] != "bottom") {
						used[fromFloor + "_" + toFloor + "_" + cx + "_" + cy] = true;
						used[toFloor + "_" + fromFloor + "_" + toLoc[0] + "_" + toLoc[1]] = true;
					}
					if (everyLayer != nowLayer) continue;
					// 四侧最远位置
					if (!flags.viewingLayer) {
						if (left > centerX - tw / 2 - th / 2 && nowLayer == (flags.viewingLayer || 0)) left = centerX - tw / 2 - th / 2;
						if (right < centerX + tw / 2 + th / 2 && nowLayer == (flags.viewingLayer || 0)) right = centerX + tw / 2 + th / 2;
						if (down < centerY + th / 2 && nowLayer == (flags.viewingLayer || 0)) down = centerY + th / 2;
						if (up > centerY - th / 2 && nowLayer == (flags.viewingLayer || 0)) up = centerY - th / 2;
					}
					// 不同高度层之间的连线
					if (!used[fromFloor + "_" + toFloor + "_" + cx + "_" + cy]) {
						core.setAlpha(ctx, opacity * Math.max(0, 1 - 0.34 * Math.abs(nowLayer - (flags.viewingLayer || 0))));
						if (step[0] == "top") {
							core.drawLine(ctx, centerX, centerY + deltaH, centerX, centerY, "#ffffff", 5 * scale);
							core.drawLine(ctx, centerX, centerY + deltaH, centerX, centerY, "#000000", 2 * scale);
							used[fromFloor + "_" + toFloor + "_" + cx + "_" + cy] = true;
							used[toFloor + "_" + fromFloor + "_" + toLoc[0] + "_" + toLoc[1]] = true;
						}
					}
					if (!used[toFloor]) {
						used[toFloor] = true;
						// 设置不透明度
						if (nowLayer == (flags.viewingLayer || 0)) {
							core.setAlpha(ctx, opacity);
						} else {
							core.setAlpha(ctx, minorAlpha * Math.max(0, 1 - 0.34 * Math.abs(nowLayer - (flags.viewingLayer || 0))));
						}
						// 画地图
						var nodes = [
							[centerX - tw / 2 - th / 2, centerY + th / 2], // 左下
							[centerX + tw / 2 - th / 2, centerY + th / 2], // 右下
							[centerX + tw / 2 + th / 2, centerY - th / 2], // 右上
							[centerX - tw / 2 + th / 2, centerY - th / 2] // 左上
						];
						if (core.hasVisitedFloor(toFloor)) {
							core.fillPolygon(ctx, nodes, "#000000");
						} else {
							core.fillPolygon(ctx, nodes, "#ff22ff");
						}
						core.strokePolygon(ctx, nodes, "#ffffff", 1.5 * scale);
					}
					// 不同高度层之间的连线
					if (!used[fromFloor + "_" + toFloor + "_" + cx + "_" + cy]) {
						if (step[0] == "bottom") {
							core.drawLine(ctx, centerX, centerY, centerX, centerY - deltaH, "#ffffff", 5 * scale);
							core.drawLine(ctx, centerX, centerY, centerX, centerY - deltaH, "#000000", 2 * scale);
							used[fromFloor + "_" + toFloor + "_" + cx + "_" + cy] = true;
							used[toFloor + "_" + fromFloor + "_" + toLoc[0] + "_" + toLoc[1]] = true;
						}
					}
				}
			}
			// 自动缩放
			if ((right - left > core.__PIXELS__ - 64 || down - up > core.__PIXELS__ - 64) && !userScale && !fromMini) {
				scale = 1 / (Math.max(right - left, down - up) / (core.__PIXELS__ - 64));
				var con = { fromUser: fromUser, oriFloor: oriFloor, scale: scale, interval: interval * scale, opacity: opacity, loop: loop, use3D: true };
				return core.draw3DFlyMap(ctx, x, y, width, height, floorId, con);
			}
			// 大地图和楼层地图自适配定位
			if (ctx == "mapOnUi")
				core.relocateCanvas("mapOnUi", -240 + (-left - right + 2 * nx) / 2, -240 + (-up - down + 2 * ny) / 2);
		};
		// 不同高度楼层排序
		this.sortFloor = function (map) {
			map = map || core.getFlyMap(null, true);
			var totalLayer = 1,
				topLayer = 0,
				bottomLayer = 0,
				nowLayer = 0;
			// 拆分map
			for (var i in map) {
				var route = i.split(",");
				nowLayer = 0;
				for (var one in route) {
					var step = route[one].split("_");
					// 层数处理 并记录每一层的层数
					if (step[0] == "top") {
						nowLayer++;
						map[i] = nowLayer + "_" + map[i];
						if (nowLayer > topLayer) topLayer = nowLayer;
					}
					if (step[0] == "bottom") {
						nowLayer--;
						map[i] = nowLayer + "_" + map[i];
						if (nowLayer < bottomLayer) bottomLayer = nowLayer;
					}
				}
			}
			// 总层数
			totalLayer = topLayer - bottomLayer + 1;
			// 按楼层高度由低到高排序
			// 先变成数组
			var mapArr = [];
			for (var one in map) {
				mapArr.push([one, parseInt(map[one]) || 0]);
			}
			// 再sort
			mapArr.sort(function (a, b) { return a[1] - b[1]; });
			return { map: mapArr, totalLayer: totalLayer, top: topLayer, bottom: bottomLayer };
		};
		// 由方向获得楼层坐标
		this.getFloorByDirection = function (direction, floorId) {
			floorId = floorId || core.status.floorId;
			var route = core.getFlyMap(floorId);
			for (var step in route) {
				if (step.indexOf(direction) >= 0) {
					return route[step];
				}
			}
			return null;
		};
		////// 转换楼层结束的事件 检查小地图 //////
		var originAfterChangeFloor = core.events.afterChangeFloor;
		events.prototype.afterChangeFloor = function (floorId) {
			if (!flags.__useMinimap__ || core.isReplaying()) {
				core.deleteCanvas("minimap");
				core.deleteCanvas("mapArrow");
				core.unregisterAction("ondown", "closeMinimap");
				core.unregisterAction("ondown", "openMinimap");
				return originAfterChangeFloor.call(core.events, floorId);
			}
			if (main.mode != 'play') return;
			this.eventdata.afterChangeFloor(floorId);
			// 防止小地图出问题
			core.unregisterAction("ondown", "closeMinimap");
			core.unregisterAction("ondown", "openMinimap");
			// 切换小地图
			core.checkMinimap(true, true);
			return;
		};
		////// 瞬间移动 检查小地图 //////
		var originMoveDirectly = core.control.moveDirectly;
		control.prototype.moveDirectly = function (destX, destY, ignoreSteps) {
			if (!flags.__useMinimap__ || core.isReplaying())
				return originMoveDirectly.call(core.control, destX, destY, ignoreSteps);
			var canMoveDirectly = this.controldata.moveDirectly(destX, destY, ignoreSteps);
			if (canMoveDirectly) core.checkMinimap();
			return canMoveDirectly;
		};
		////// 每移动一格后执行的事件 检查小地图 //////
		var originMoveOneStep = core.control.moveOneStep;
		control.prototype.moveOneStep = function (callback) {
			if (!flags.__useMinimap__ || core.isReplaying())
				return originMoveOneStep.call(core.control, callback);
			this.controldata.moveOneStep(callback);
			core.checkMinimap();
		};
		// 检查小地图开闭情况 改变小地图位置
		this.checkMinimap = function (fromUser, reDraw) {
			if (!flags.__useMinimap__ || core.isReplaying()) {
				core.unregisterAction("ondown", "closeMinimap");
				core.unregisterAction("ondown", "openMinimap");
				core.deleteCanvas("mapArrow");
				core.deleteCanvas("minimap");
				return;
			}
			reDraw = reDraw || false;
			// 是否重绘
			if (reDraw) {
				if (flags.minimap) core.drawMinimap(flags.__onLeft__);
				else core.drawClosedMap(flags.__onLeft__);
			}
			var hx = core.status.hero.loc.x;
			var opened = flags.minimap;
			var onLeft = hx >= Math.ceil(core.__SIZE__ / 3 * 2);
			fromUser = fromUser || false; // 开关小地图相关
			if (!flags.__onLeft__) flags.__onLeft__ = false;
			// 如果地图上没有小地图 画到右边
			if (!core.dymCanvas.mapArrow && !core.dymCanvas.minimap && !reDraw) {
				if (flags.minimap) core.drawMinimap();
				else core.drawClosedMap();
				flags.__onLeft__ = false;
			}
			// 人物在中间 不执行
			if (hx >= Math.ceil(core.__SIZE__ / 3 + core.bigmap.offsetX / 32) &&
				hx <= Math.floor(core.__SIZE__ / 3 * 2 + core.bigmap.offsetX / 32)) return;
			// 重定位画布 和 翻转
			// 挪到右边
			if (!onLeft && (flags.__onLeft__ || fromUser)) {
				flags.__onLeft__ = false;
				if (opened) {
					core.relocateCanvas("minimap", core.__PIXELS__ - 120, 0);
					core.relocateCanvas("mapArrow", core.__PIXELS__ - 140, 0);
					document.getElementById('mapArrow').style.transform = 'none';
				} else {
					core.relocateCanvas("minimap", core.__PIXELS__, 0);
					core.relocateCanvas("mapArrow", core.__PIXELS__ - 20, 0);
					document.getElementById('mapArrow').style.transform = 'none';
				}
			}
			// 挪到左边
			if (onLeft && (!flags.__onLeft__ || fromUser)) {
				flags.__onLeft__ = true;
				if (opened) {
					core.relocateCanvas("minimap", 0, 0);
					core.relocateCanvas("mapArrow", 120, 0);
					document.getElementById('mapArrow').style.transform = 'rotateY(180deg)';
				} else {
					core.relocateCanvas("minimap", -120, 0);
					core.relocateCanvas("mapArrow", 0, 0);
					document.getElementById('mapArrow').style.transform = 'rotateY(180deg)';
				}
			}
		};
		// 点击小地图的action
		this.registerMinimapAction = function (open) {
			if (!open) {
				core.registerAction("ondown", "closeMinimap", function (x, y, px, py) {
					if (!flags.__onLeft__) {
						if (px >= core.__PIXELS__ - 140 && px <= core.__PIXELS__ - 120 &&
							py >= 0 && py <= 120) {
							core.closeMinimap();
							core.unregisterAction("ondown", "closeMinimap");
							return true;
						}
						if (px >= core.__PIXELS__ - 120 && py <= 120) {
							core.playSound("打开界面");
							core.drawTotalMap();
							return true;
						}
					} else {
						if (px >= 120 && px <= 140 && py >= 0 && py <= 120) {
							core.closeMinimap();
							core.unregisterAction("ondown", "closeMinimap");
							return true;
						}
						if (px <= 120 && py <= 120) {
							core.playSound("打开界面");
							core.drawTotalMap();
							return true;
						}
					}
				}, 10);
			} else {
				core.registerAction("ondown", "openMinimap", function (x, y, px, py) {
					if (!flags.__onLeft__) {
						if (px >= core.__PIXELS__ - 20 && py <= 120) {
							core.openMinimap();
							core.unregisterAction("ondown", "openMinimap");
							return true;
						}
					} else {
						if (px <= 20 && py <= 120) {
							core.openMinimap();
							core.unregisterAction("ondown", "openMinimap");
							return true;
						}
					}
				}, 10);
			}
		};
		// 地图上的小地图
		this.drawMinimap = function (toLeft) {
			if (!flags.__useMinimap__) {
				core.deleteCanvas("mapArrow");
				core.deleteCanvas("minimap");
				return;
			}
			var scale = 1.3 / core.status.thisMap.width * 15 * (flags.userScale || 1);
			if (1.3 / core.status.thisMap.height * 15 * (flags.userScale || 1) < scale)
				scale = 1.3 / core.status.thisMap.height * 15 * (flags.userScale || 1);
			// 绘制
			core.createCanvas("minimap", core.__PIXELS__ - 120, 0, 120, 120, 100);
			core.createCanvas("mapArrow", core.__PIXELS__ - 140, 0, 20, 120, 100);
			if (toLeft) {
				core.relocateCanvas("minimap", 0, 0);
				core.relocateCanvas("mapArrow", 120, 0);
				document.getElementById('mapArrow').style.transform = 'rotateY(180deg)';
			}
			core.clearMap("minimap");
			core.clearMap("mapArrow");
			// 黑色底
			core.fillRect("minimap", 0, 0, 120, 120, [0, 0, 0, 0.6]);
			var config = { fromUser: true, oriFloor: core.status.floorId, scale: scale, interval: 10, noErase: true, fromMini: true };
			core.drawFlyMap("minimap", 0, 0, 120, 120, core.status.floorId, config);
			// 向右箭头
			core.fillRect("mapArrow", 0, 0, 20, 120, [230, 230, 230, 0.9]);
			core.drawLine("mapArrow", 0, 20, 20, 20, [100, 100, 100, 0.9], 2);
			core.drawLine("mapArrow", 0, 100, 20, 100, [100, 100, 100, 0.9], 2);
			core.setTextAlign("mapArrow", "center");
			core.fillText("mapArrow", ">", 10, 67, [100, 100, 100, 0.9], "20px Verdana");
			core.registerMinimapAction(false);
		};
		// 关闭小地图
		this.closeMinimap = function () {
			if (!flags.__useMinimap__) {
				core.deleteCanvas("mapArrow");
				core.deleteCanvas("minimap");
				return;
			}
			var onLeft = flags.__onLeft__;
			var frame = 0;
			var x = core.__PIXELS__,
				a = 0.096,
				speed = 4.8;
			if (onLeft) {
				x = 260;
				a = -a;
				speed = -speed;
			}
			var interval = setInterval(function () {
				core.relocateCanvas("mapArrow", x - 140, 0);
				if (!onLeft)
					core.relocateCanvas("minimap", x - 120, 0);
				else core.relocateCanvas("minimap", x - 260, 0);
				speed -= a;
				x += speed;
				if (frame == 50) {
					flags.minimap = false;
					clearInterval(interval);
					core.drawClosedMap(onLeft);
					core.checkMinimap(true);
				}
				frame++;
			}, 20);
		};
		// 合上的小地图
		this.drawClosedMap = function (toLeft) {
			if (!flags.__useMinimap__) {
				core.deleteCanvas("mapArrow");
				core.deleteCanvas("minimap");
				return;
			}
			var scale = 1.3 / core.status.thisMap.width * 15 * (flags.userScale || 1);
			if (1.3 / core.status.thisMap.height * 15 * (flags.userScale || 1) < scale)
				scale = 1.3 / core.status.thisMap.height * 15 * (flags.userScale || 1);
			// 绘制
			core.createCanvas("minimap", core.__PIXELS__, 0, 120, 120, 100);
			core.createCanvas("mapArrow", core.__PIXELS__ - 20, 0, 20, 120, 100);
			core.clearMap("minimap");
			core.clearMap("mapArrow");
			if (toLeft) {
				core.relocateCanvas("minimap", -120, 0);
				core.relocateCanvas("mapArrow", 0, 0);
				document.getElementById('mapArrow').style.transform = 'rotateY(180deg)';
			}
			// 黑色底
			core.fillRect("minimap", 0, 0, 120, 120, [0, 0, 0, 0.6]);
			var config = { fromUser: true, oriFloor: core.status.floorId, scale: scale, interval: 10, noErase: true, fromMini: true };
			core.drawFlyMap("minimap", 0, 0, 120, 120, core.status.floorId, config);
			// 向左箭头
			core.fillRect("mapArrow", 0, 0, 20, 120, [230, 230, 230, 0.9]);
			core.drawLine("mapArrow", 0, 20, 20, 20, [100, 100, 100, 0.9], 2);
			core.drawLine("mapArrow", 0, 100, 20, 100, [100, 100, 100, 0.9], 2);
			core.setTextAlign("mapArrow", "center");
			core.fillText("mapArrow", "<", 10, 67, [100, 100, 100, 0.9], "20px Verdana");
			core.registerMinimapAction(true);
		};
		// 打开小地图
		this.openMinimap = function () {
			if (!flags.__useMinimap__) {
				core.deleteCanvas("mapArrow");
				core.deleteCanvas("minimap");
				return;
			}
			var onLeft = flags.__onLeft__;
			var frame = 0;
			var x = 120 + core.__PIXELS__,
				a = 0.096,
				speed = 4.8;
			if (onLeft) {
				x = 140;
				a = -a;
				speed = -speed;
			}
			var interval = setInterval(function () {
				core.relocateCanvas("mapArrow", x - 140, 0);
				if (!flags.__onLeft__)
					core.relocateCanvas("minimap", x - 120, 0);
				else core.relocateCanvas("minimap", x - 260, 0);
				speed -= a;
				x -= speed;
				if (frame == 50) {
					flags.minimap = true;
					clearInterval(interval);
					core.drawMinimap(onLeft);
					core.checkMinimap(true);
				}
				frame++;
			}, 20);
		};
		// 大地图
		this.drawTotalMap = function (floorId) {
			floorId = floorId || core.status.floorId;
			core.status.event.id = "totalMap";
			core.lockControl();
			if (!flags.viewingLayer) flags.viewingLayer = 0;
			var loop = 5;
			if (flags.worldMap) loop = core.floorIds.length;
			// 大地图时点击和键盘操作
			core.registerAction("ondown", "onDownTmap", function (x, y) {
				if (core.status.event.id == "totalMap") {
					if (y < 1 && x <= Math.floor(core.__SIZE__ / 2) - 2) { // 上移一层
						if (flags.viewingLayer < core.sortFloor().top) {
							flags.viewingLayer++;
							core.playSound('光标移动');
							core.drawTotalMap();
						}
						return true;
					}
					if (y < 1 && x >= Math.ceil(core.__SIZE__ / 2) + 1) { // 下移一层
						if (flags.viewingLayer > core.sortFloor().bottom) {
							flags.viewingLayer--;
							core.playSound('光标移动');
							core.drawTotalMap();
						}
						return true;
					}
					if (y < 1 && x < Math.ceil(core.__SIZE__ / 2) + 1 && x > Math.floor(core.__SIZE__ / 2) - 2) {
						// 区域地图
						if (flags.worldMap) {
							flags.worldMap = false;
							flags.viewingLayer = 0;
						} else flags.worldMap = true;
						core.playSound('光标移动');
						core.drawTotalMap();
						return true;
					}
					if (y >= core.__SIZE__ - 1 && x <= Math.floor(core.__SIZE__ / 2)) { // 3D
						if (core.can3D(floorId) && !flags.in3D) flags.use3D = true;
						if (flags.in3D) flags.use3D = false;
						flags.mapHint = false;
						core.playSound('光标移动');
						core.drawTotalMap();
						return true;
					}
					if (y >= core.__SIZE__ - 1 && x >= Math.ceil(core.__SIZE__ / 2)) { // hint
						if (flags.in3D) {
							if (!flags.mapHint) flags.mapHint = true;
							else flags.mapHint = false;
							core.playSound('光标移动');
							core.drawTotalMap();
						}
						return true;
					}
					flags.viewingLayer = 0;
					core.playSound("取消")
					core.deleteCanvas("mapOnUi");
					core.deleteCanvas("back");
					core.deleteCanvas("tips");
					core.closePanel();
					core.unregisterAction("ondown", "onDownTmap");
					return true;
				}
			}, 110);
			core.registerAction("keyUp", "keyUpTmap", function (keycode) {
				if (core.status.event.id == "totalMap") {
					if (keycode == 33) { // PgUp
						if (flags.viewingLayer < core.sortFloor().top) {
							flags.viewingLayer++;
							core.playSound('光标移动');
							core.drawTotalMap();
						}
						return true;
					}
					if (keycode == 34) { // PgDn
						if (flags.viewingLayer > core.sortFloor().bottom) {
							flags.viewingLayer--;
							core.playSound('光标移动');
							core.drawTotalMap();
						}
						return true;
					}
					if (keycode == 90) { // Z
						if (core.can3D(floorId) && !flags.in3D) flags.use3D = true;
						if (flags.in3D) flags.use3D = false;
						flags.mapHint = false;
						core.playSound('光标移动');
						core.drawTotalMap();
						return true;
					}
					if (keycode == 84) { // T
						if (flags.in3D) {
							if (!flags.mapHint) flags.mapHint = true;
							else flags.mapHint = false;
							core.playSound('光标移动');
							core.drawTotalMap();
						}
						return true;
					}
					if (keycode == 87) { // W
						if (flags.worldMap) {
							flags.worldMap = false;
							flags.viewingLayer = 0;
						} else flags.worldMap = true;
						core.playSound('光标移动');
						core.drawTotalMap();
						return true;
					}
					flags.viewingLayer = 0;
					core.playSound("取消")
					core.deleteCanvas("mapOnUi");
					core.deleteCanvas("back");
					core.deleteCanvas("tips");
					core.closePanel();
					core.unregisterAction("keyUp", "keyUpTmap");
					return true;
				}
			}, 110);
			// 开始画
			core.createCanvas("mapOnUi", -240, -240, core.__PIXELS__ + 480, core.__PIXELS__ + 480, 150);
			core.createCanvas("back", -240, -240, core.__PIXELS__ + 480, core.__PIXELS__ + 480, 140);
			core.createCanvas("tips", 0, 0, core.__PIXELS__, core.__PIXELS__, 160);
			var ctx = document.getElementById("tips").getContext("2d");
			ctx.shadowOffsetX = 0;
			ctx.shadowOffsetY = 0;
			ctx.shadowBlur = 5;
			ctx.shadowColor = "rgba(100, 100, 255, 1)";
			core.fillRect("back", -240, -240, core.__PIXELS__ + 480, core.__PIXELS__ + 480, [0, 0, 0, 0.9]);
			core.fillRect("tips", 0, 0, core.__PIXELS__ / 2 - 50, 32, [200, 200, 200, 0.8]);
			core.fillRect("tips", core.__PIXELS__ / 2 + 50, 0, core.__PIXELS__ / 2 - 50, 32, [200, 200, 200, 0.8]);
			core.fillRect("tips", core.__PIXELS__ / 2 - 46, 0, 92, 32, [200, 200, 200, 0.8]);
			core.drawLine("tips", 0, 32, core.__PIXELS__ / 2 - 50, 32, [50, 50, 50, 0.8], 3);
			core.drawLine("tips", core.__PIXELS__ / 2 + 50, 32, core.__PIXELS__, 32, [50, 50, 50, 0.8], 3);
			core.drawLine("tips", core.__PIXELS__ / 2 - 46, 32, core.__PIXELS__ / 2 + 46, 32, [50, 50, 50, 0.8], 3);
			core.fillRect("tips", 0, core.__PIXELS__, core.__PIXELS__ / 2 - 5, -32, [200, 200, 200, 0.8]);
			core.fillRect("tips", core.__PIXELS__ / 2 + 5, core.__PIXELS__, core.__PIXELS__ / 2 - 5, -32, [200, 200, 200, 0.8]);
			core.drawLine("tips", 0, core.__PIXELS__ - 32, core.__PIXELS__ / 2 - 5, core.__PIXELS__ - 32, [50, 50, 50, 0.8], 3);
			core.drawLine("tips", core.__PIXELS__ / 2 + 5, core.__PIXELS__ - 32, core.__PIXELS__, core.__PIXELS__ - 32, [50, 50, 50, 0.8], 3);
			core.setTextAlign("tips", "center");
			core.fillText("tips", "上移一层", core.__PIXELS__ / 4 - 23, 24, [255, 255, 255, 0.8], "24px " + core.status.globalAttribute.font);
			core.fillText("tips", "下移一层", core.__PIXELS__ / 4 * 3 + 23, 24, [255, 255, 255, 0.8], "24px " + core.status.globalAttribute.font);
			core.fillText("tips", flags.worldMap ? "小地图" : "区域地图", core.__PIXELS__ / 2, 24, [255, 255, 255, 0.8], "24px " + core.status.globalAttribute.font);
			core.drawFlyMap("mapOnUi", 240, 240, core.__PIXELS__, core.__PIXELS__,
				floorId, { fromUser: true, opacity: 1, oriFloor: floorId, noErase: true, use3D: flags.use3D, layer: flags.viewingLayer, loop: loop, clearCache: true });
			if (flags.in3D)
				core.fillText("tips", "参考线（T）", core.__PIXELS__ / 4 * 3, core.__PIXELS__ - 8, [255, 255, 255, 0.8], "24px " + core.status.globalAttribute.font);
			if (core.can3D(floorId) && !flags.in3D)
				core.fillText("tips", "3D模式（Z）", core.__PIXELS__ / 4, core.__PIXELS__ - 8, [255, 255, 255, 0.8], "24px " + core.status.globalAttribute.font);
			if (flags.in3D)
				core.fillText("tips", "2D模式（Z）", core.__PIXELS__ / 4, core.__PIXELS__ - 8, [255, 255, 255, 0.8], "24px " + core.status.globalAttribute.font);
			if (flags.mapHint) {
				core.drawLine("back", 240, 240 + core.__PIXELS__, 240 + core.__PIXELS__, 240, [100, 100, 240, 0.4], 2);
				core.drawLine("back", 240 + core.__PIXELS__ / 2, 240, 240 + core.__PIXELS__ / 2, 240 + core.__PIXELS__, [100, 100, 240, 0.4], 2);
				core.drawLine("back", 240, 240 + core.__PIXELS__ / 2, 240 + core.__PIXELS__, 240 + core.__PIXELS__ / 2, [100, 100, 240, 0.4], 2);
			}
		};
	}
}