        'icons': {
            'floor': 0,
            'name': null,
            'lv': 1,
            'hpmax': 2,
            'hp': 3,
            'atk': 4,
            'def': 5,
            'mdef': 6,
            'money': 7,
            'exp': 8,
            'up': 9,
            'book': 10,
            'fly': 11,
            'toolbox': 12,
            'keyboard': 13,
            'shop': 14,
            'save': 15,
            'load': 16,
            'settings': 17,
            'play': 18,
            'pause': 19,
            'stop': 20,
            'speedDown': 21,
            'speedUp': 22,
            'rewind': 23,
            'equipbox': 24,
            'mana': 25,
            'skill': 26,
            'btn1': 27,
            'btn2': 28,
            'btn3': 29,
            'btn4': 30,
            'btn5': 31,
            'btn6': 32,
            'btn7': 33,
            'btn8': 34
        },

        ```html
<div id="toolBar" class="clearfix" style="left: 0px; width: 150px; top: 191.308px; height: 19.1538px; background: url(&quot;project/materials/ground.png&quot;) repeat; border-left: 3px solid rgb(204, 204, 204); font-size: 5.53846px; display: block; border-bottom: 3px solid rgb(204, 204, 204); border-right: 3px solid rgb(204, 204, 204);">
        <img class="tools" id="img-book" src="<!-- 与问题无关，略。下同-->" style="height: 10.5231px; margin-left: 3.11538px; margin-top: 1.03846px; display: none; opacity: 0.3;">
        <img class="tools" id="img-fly" style="height: 10.5231px; margin-left: 3.11538px; margin-top: 1.03846px; display: none; opacity: 0.3;">
        <img class="tools" id="img-toolbox"style="height: 10.5231px; margin-left: 3.11538px; margin-top: 1.03846px; display: none;">
        <img class="tools" id="img-keyboard" style="height: 10.5231px; margin-left: 3.11538px; margin-top: 1.03846px; display: none;">
        <img class="tools" id="img-shop"  style="height: 10.5231px; margin-left: 3.11538px; margin-top: 1.03846px; display: none;">
        <img class="tools" id="img-save" style="height: 10.5231px; margin-left: 3.11538px; margin-top: 1.03846px; display: none; opacity: 1;">
        <img class="tools" id="img-load" style="height: 10.5231px; margin-left: 3.11538px; margin-top: 1.03846px; display: none;">
        <img class="tools" id="img-settings" style="height: 10.5231px; margin-left: 3.11538px; margin-top: 1.03846px; display: none;">
        <img class="tools" id="img-btn1" style="height: 10.5231px; margin-left: 3.11538px; margin-top: 1.03846px; display: block;">
        <img class="tools" id="img-slime" style="height: 10.5231px; margin-left: 3.11538px; margin-top: 1.03846px;">
        <img class="tools" id="img-btn2" style="display: block; height: 10.5231px; margin-left: 3.11538px; margin-top: 1.03846px;" >
        <img class="tools" id="img-btn3" style="display: block; height: 10.5231px; margin-left: 3.11538px; margin-top: 1.03846px;" >
        <img class="tools" id="img-btn4" style="display: block; height: 10.5231px; margin-left: 3.11538px; margin-top: 1.03846px;" >
        <img class="tools" id="img-btn5" style="display: block; height: 10.5231px; margin-left: 3.11538px; margin-top: 1.03846px;" >
        <img class="tools" id="img-btn6" style="display: block; height: 10.5231px; margin-left: 3.11538px; margin-top: 1.03846px;" >
        <img class="tools" id="img-btn7" style="display: block; height: 10.5231px; margin-left: 3.11538px; margin-top: 1.03846px;" >
        <img class="tools" id="img-btn8" style="display: block; height: 10.5231px; margin-left: 3.11538px; margin-top: 1.03846px;" >
        <p class="statusLabel tools" id="hard" _style="rgba(64,255,85,1)" style="line-height: 10.5231px; margin-left: 3.11538px; height: 10.5231px; margin-top: 1.03846px; width: 20.5154px; color: rgb(64, 255, 85);"></p>
    </div>
        ```

```js
control.prototype._resize_toolBar = function (obj) {
    // toolBar console.log(obj);
    var toolBar = core.dom.toolBar;
    if (core.domStyle.isVertical) {
        toolBar.style.left = 0;
        toolBar.style.right = "";
        toolBar.style.width = obj.outerSize + "px";
        toolBar.style.top = obj.statusBarHeightInVertical + obj.outerSize + "px";
        toolBar.style.height = obj.toolbarHeightInVertical + "px";
        toolBar.style.background = obj.globalAttribute.toolsBackground;
    }
    else {
        if (obj.extendToolbar) {
            toolBar.style.left = "";
            toolBar.style.right = 0;
            toolBar.style.width = obj.outerSize + "px";
            toolBar.style.top = obj.outerSize + "px";
            toolBar.style.height = obj.TOOLBAR_HEIGHT * core.domStyle.scale + obj.BORDER + "px";
            toolBar.style.background = obj.globalAttribute.toolsBackground;
        } else {
            toolBar.style.left = 0;
            toolBar.style.right = "";
            toolBar.style.width = obj.BAR_WIDTH * core.domStyle.scale + obj.BORDER + "px";
            toolBar.style.top = 0.718 * obj.outerSize + "px";
            toolBar.style.height = 0.281 * obj.outerSize + "px";
            toolBar.style.background = 'transparent';
        }
    }
    toolBar.style.borderLeft = obj.border;
    toolBar.style.borderRight = toolBar.style.borderBottom = core.domStyle.isVertical || obj.extendToolbar ? obj.border : '';
    toolBar.style.fontSize = 16 * core.domStyle.scale + "px";

    if (!core.domStyle.showStatusBar && !core.domStyle.isVertical && !obj.extendToolbar) {
        toolBar.style.display = 'none';
    } else {
        toolBar.style.display = 'block';
    }
}
```
目测为控制toolBar形状的关键函数！
resize函数很关键
```js
control.prototype.resize = function () {
    if (main.mode == 'editor') return;
    var clientWidth = main.dom.body.clientWidth, clientHeight = main.dom.body.clientHeight;
    var CANVAS_WIDTH = core.__PIXELS__, BAR_WIDTH = Math.round(core.__PIXELS__ * 0.31);
    var BORDER = 3;
    var extendToolbar = core.flags.extendToolbar;

    var horizontalMaxRatio = (clientHeight - 2 * BORDER - (extendToolbar ? BORDER : 0)) / (CANVAS_WIDTH + (extendToolbar ? 38 : 0));

    if (clientWidth - 3 * BORDER >= CANVAS_WIDTH + BAR_WIDTH || (clientWidth > clientHeight && horizontalMaxRatio < 1)) {
        // 横屏
        core.domStyle.isVertical = false;

        core.domStyle.availableScale = [];
        [1, 1.25, 1.5, 1.75, 2, 2.25, 2.5].forEach(function (v) {
            if (clientWidth - 3 * BORDER >= v * (CANVAS_WIDTH + BAR_WIDTH) && horizontalMaxRatio >= v) {
                core.domStyle.availableScale.push(v);
            }
        });
        if (core.domStyle.availableScale.indexOf(core.domStyle.scale) < 0) {
            core.domStyle.scale = Math.min(1, horizontalMaxRatio);
        }
    }
    else {
        // 竖屏
        core.domStyle.isVertical = true;
        core.domStyle.scale = Math.min((clientWidth - 2 * BORDER) / CANVAS_WIDTH);
        core.domStyle.availableScale = [];
        extendToolbar = false;
    }

    var statusDisplayArr = this._shouldDisplayStatus(), count = statusDisplayArr.length;
    var statusCanvas = core.flags.statusCanvas, statusCanvasRows = core.values.statusCanvasRowsOnMobile || 3;
    var col = statusCanvas ? statusCanvasRows : Math.ceil(count / 3);
    if (col > 5) {
        if (statusCanvas) alert("自绘状态栏的在竖屏下的行数应不超过5！");
        else alert("当前状态栏数目(" + count + ")大于15，请调整到不超过15以避免手机端出现显示问题。");
    }
    var globalAttribute = core.status.globalAttribute || core.initStatus.globalAttribute;

    var obj = {
        clientWidth: clientWidth,
        clientHeight: clientHeight,
        CANVAS_WIDTH: CANVAS_WIDTH,
        BORDER: BORDER,
        BAR_WIDTH: BAR_WIDTH,
        TOOLBAR_HEIGHT: 38,
        outerSize: CANVAS_WIDTH * core.domStyle.scale + 2 * BORDER,
        globalAttribute: globalAttribute,
        border: '3px ' + core.arrayToRGBA(globalAttribute.borderColor) + ' solid',
        statusDisplayArr: statusDisplayArr,
        count: count,
        col: col,
        statusBarHeightInVertical: core.domStyle.isVertical ? (32 * col + 6) * core.domStyle.scale + 2 * BORDER : 0,
        toolbarHeightInVertical: core.domStyle.isVertical ? 38 * core.domStyle.scale + 2 * BORDER : 0,
        extendToolbar: extendToolbar,
        is15x15: core.__SIZE__ == 15
    };

    this._doResize(obj);
    this.setToolbarButton();
    core.updateStatusBar();
}
```

```js
////// 工具栏界面时的点击操作 //////
actions.prototype._clickToolbox

```
疑似看的是event.id 神人设计

尝试修改，改动总结
```js
// # main.js
    this.statusBar = {
        'image': {
            'floor': document.getElementById('img-floor'),
            'name': document.getElementById('img-name'),
            'lv': document.getElementById('img-lv'),
            'hpmax': document.getElementById('img-hpmax'),
            'hp': document.getElementById("img-hp"),
            'mana': document.getElementById("img-mana"),
            'atk': document.getElementById("img-atk"),
            'def': document.getElementById("img-def"),
            'mdef': document.getElementById("img-mdef"),
            'money': document.getElementById("img-money"),
            'exp': document.getElementById("img-exp"),
            'up': document.getElementById("img-up"),
            'skill': document.getElementById('img-skill'),
            'book': document.getElementById("img-book"),
            'fly': document.getElementById("img-fly"),
            'toolbox': document.getElementById("img-toolbox"),
            'keyboard': document.getElementById("img-keyboard"),
            'shop': document.getElementById('img-shop'),
            'save': document.getElementById("img-save"),
            'load': document.getElementById("img-load"),
            'settings': document.getElementById("img-settings"),
            'btn1': document.getElementById("img-btn1"),
            'btn2': document.getElementById("img-btn2"),
            'btn3': document.getElementById("img-btn3"),
            'btn4': document.getElementById("img-btn4"),
            'btn5': document.getElementById("img-btn5"),
            'btn6': document.getElementById("img-btn6"),
            'btn7': document.getElementById("img-btn7"),
            'btn8': document.getElementById("img-btn8"),
            'slime': document.getElementById('img-slime'), // 增加
        },
        //... this.statsBar.image中添加slime

                'icons': {
            'floor': 0,
            'name': null,
            'lv': 1,
            'hpmax': 2,
            'hp': 3,
            'atk': 4,
            'def': 5,
            'mdef': 6,
            'money': 7,
            'exp': 8,
            'up': 9,
            'book': 10,
            'fly': 11,
            'toolbox': 12,
            'keyboard': 13,
            'shop': 14,
            'save': 15,
            'load': 16,
            'settings': 17,
            'play': 18,
            'pause': 19,
            'stop': 20,
            'speedDown': 21,
            'speedUp': 22,
            'rewind': 23,
            'equipbox': 24,
            'mana': 25,
            'skill': 26,
            'btn1': 27,
            'btn2': 28,
            'btn3': 29,
            'btn4': 30,
            'btn5': 31,
            'btn6': 32,
            'btn7': 33,
            'btn8': 34,
            'slime': 35, // 增加
        },
        //... this.statsBar.icon中添加slime 会自动采用该列第35个图片作为相应的icon
    }

    main.statusBar.image.slime.onclick = function (e) {
        e.stopPropagation();
        console.log(1);
    };
    //... 添加slime的点击事件
```


那么元素img-slime从哪来呢？
答案是index.html
```js
    <div id="toolBar" class="clearfix">
        <img class="tools" id='img-book'>
        <img class="tools" id='img-fly'>
        <img class="tools" id='img-toolbox'>
        <img class="tools" id='img-keyboard'>
        <img class="tools" id='img-shop'>
        <img class="tools" id='img-save'>
        <img class="tools" id='img-load'>
        <img class="tools" id='img-settings'>
        <img class="tools" id='img-btn1' >
        <img class="tools" id='img-slime' >
        <img class="tools" id='img-btn2' style='display:none'>
        <img class="tools" id='img-btn3' style='display:none'>
        <img class="tools" id='img-btn4' style='display:none'>
        <img class="tools" id='img-btn5' style='display:none'>
        <img class="tools" id='img-btn6' style='display:none'>
        <img class="tools" id='img-btn7' style='display:none'>
        <img class="tools" id='img-btn8' style='display:none'>
        <p class="statusLabel tools" id="hard"></p>
    </div>
```

controls中的函数_updateStatusBar_setToolboxIcon也很重要，该函数调控进/出录像模式的图标变化
setToolbarButton 改变工具栏为按钮1-8

todo:长弹幕显示不全 done
todo:点取消卡死 done
todo:未知的自动拾取导致bug 为什么其它塔没有bug? 有待将来观察
todo:2.10其它改动

todo:放缩下存档界面显示不全 楼传等？
快速移动待测 不知道为什么体感时间远比显示时间长