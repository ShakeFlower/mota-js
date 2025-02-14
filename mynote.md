tileset只有noPass属性。设置noPass为false的瞬间就会写入project/maps.js
其它情况只要不是items就不可过。
写入可通行性对tileset只用写canPass就好
读档：```core.utils.decompress(core.saves.cache['template_save3'] );```
解码录像 core.decodeRoute(a.route);

可通行性，关键在getBlockByNumber函数。它从core.status.number2Block中获取信息。而number2Block不存在该属性时会initBlock
initBlock从blocksInfo中读

改变canPass后：（模仿setBlock）
originBlock = core.getBlock(x, y, floorId, true);获取originBlock
core.status.maps[floorId].blocks全要改
core.status.mapBlockObjs全要改

enemyInfo进存档的手法非常简单粗暴 就是存了个变量

extractBlocks->_mapIntoBlocks->initBlock

cannotOut和cannotIn的关键
箭头还在getBlockByNumber中

首先抽象一下 思考一下顶层设计
ItemBox类
需要的属性：当前持有的Item和数量 当前的页数

使用道具时，情况会改变，所以，每次重绘时，都需要获取一遍core.status.hero.items，然后依据此获取一个列表itemList。根据当前页数(currPage)获取该绘制的内容。

整个道具栏做成一个大按钮，还需要属性selectedItem 每次根据selectedItem重绘右侧的物品详细说明

按钮可往前不往后，以防一页的道具全用光会不去

点击时：点左侧 根据位置和itemList和currPage推导处在哪里，更新selectedItem，更新右侧 左侧是一个大按钮
点下方 左右 currPage
右侧按键：
使用 尝试使用selectedItem
批量使用 新功能
隐藏/显示 修改道具的隐藏属性
显示隐藏 页面级属性 showHidedItem

最高级 MenuPage 名为boxPage
拥有背景和背景中的两个箭头和道具栏|装备栏的字样
按键切换两栏 监听tab等
右下角的×

toolBox 拥有底部两按钮，右侧的一切，中间的大按钮
equipBox 拥有
```js
const itemClsName = {
    "constants": "永久道具",
    "tools": "消耗道具",
}
const itemNum = 12;

core.initThisEventInfo();
let info = core.status.thisUIEventInfo
info.index = 1;
core.setIndexAndSelect('select');
let ctx =core.canvas.ui;
core.status.thisEventClickArea = [];

let info1 = core.drawBoxBackground(ctx);
info1.itemNum = itemNum;
core.drawItemListbox(ctx, info1.obj);
core.drawToolboxRightbar(ctx, info1);

```

!mypromt callback疑似需要改回去

难绷的bug太多了 自动拾取，自动清怪，追猎等等。

moveBlock:
```js
let [x, y, steps, time, keep] = [0,0,['down'],1,false];
let blockArr = core.maps._getAndRemoveBlock(x, y);
let block = blockArr[0], blockInfo = blockArr[1];
let canvases = core.maps._initDetachedBlock(blockInfo, x, y, block.event.animate !== false);
core.maps._moveDetachedBlock(blockInfo, 32 * x, 32 * y, 1, canvases);
```
1.blockArr:[block,blockInfo]组成，同时会removeBlock
block,blockInfo有一个什么都没有，则blockArr什么都没有，则返回
接下来处理moveSteps，得到['down',1];
_initDetachedBlock返回三个canvas的对象 {headCanvas,bodyCanvas,damageCanvas}
_moveDetachedBlock：疑似是通过该函数不断移动实现移动效果

模板字符串居然不能随意填字符串，逆天