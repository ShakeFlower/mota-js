/*
control.ts负责游戏内的部分逻辑
*/

import * as init from '../project/functions/init';

/** 初始化游戏界面 */
export function initGame(): void {
    // 绘制初始界面
    init.drawStartUi();
}