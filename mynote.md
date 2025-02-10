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
