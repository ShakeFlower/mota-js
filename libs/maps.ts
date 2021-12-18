/*
maps.ts负责所有的地图操作
包括初始化、绘制、视角移动等
*/
import { core } from './core';
import { enemies } from '../project/enemies';
import * as floor from './floor';
import * as block from './block';
import * as enemy from '../project/functions/enemy';

/** 初始化所有单位 */
export function initUnits(): void {
    core.units = {
        enemy: enemies
    };
}

/** 切换楼层 */
export function changeFloor(floorId: string, x: number, y: number): void {
    // 绘制楼层
    let f = new floor.Floor(floorId, 'test');
    f.draw();
    // 勇士
    let hero = core.status.nowHero;
    hero.floor = floorId;
    hero.setLoc(x, y);
    hero.draw();
    // 计算伤害
    enemy.calculateAll(floorId, hero, {});
}

/** 单独解析某个图块 */
export function extractBlock(floorId: string | floor.Floor, layer: 'bg' | 'event' | 'fg', x: number, y: number): block.Block | void {
    let b: block.Block;
    let n: number;
    if (!(floorId instanceof floor.Floor)) {
        b = core.status.maps[floorId].block[layer][x + ',' + y];
        if (b) return b;
        n = core.status.maps[floorId][layer === 'event' ? 'map' : layer][y][x];
    } else {
        b = floorId.block[layer][x + ',' + y];
        if (b) return b;
        n = floorId[layer === 'event' ? 'map' : layer][y][x];
    }
    let id = floorId instanceof floor.Floor ? floorId.floorId : floorId
    // 剩下的没有解析的只能是tileset了
    let data = core.dict[n];
    if (data.cls !== 'tileset') return console.error('单独解析了一个不是tileset图块！');
    b = new block.Block({ id: data.id, number: n, type: 'default', x, y, floorId: id }, x, y);
    if (floorId instanceof floor.Floor) floorId.block[layer][x + ',' + y] = b;
    else core.status.maps[floorId].block[layer][x + ',' + y] = b;
    return b;
}