main.floors.MT0=
{
    "floorId": "MT0",
    "title": "主塔 0 层",
    "name": "0",
    "canFlyTo": true,
    "canFlyFrom": true,
    "canUseQuickShop": true,
    "cannotViewMap": false,
    "defaultGround": "X10036",
    "images": [],
    "ratio": 2,
    "map": [
    [201,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0],
    [  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0],
    [  0,  0,  0,  0,  0,201,  0,  0,  0,  0,  0,  0,  0],
    [  0,  0,  0,  0,  0,201,  0,  0,  0,  0,  0,  0,  0],
    [  0,  0,  0,  0,  0,202,  0,  0,  0,  0,  0,  0,  0],
    [  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0],
    [  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0],
    [  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0],
    [  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0],
    [  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0],
    [  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0],
    [  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0],
    [  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0]
],
    "firstArrive": [
        {
            "type": "setValue",
            "name": "item:wand",
            "value": "99"
        },
        {
            "type": "setValue",
            "name": "item:silverCoin",
            "value": "99"
        },
        {
            "type": "setEnemyOnPoint",
            "loc": [
                [
                    5,
                    2
                ]
            ],
            "name": "hp",
            "value": "123"
        },
        {
            "type": "setEnemyOnPoint",
            "loc": [
                [
                    5,
                    4
                ]
            ],
            "name": "hp",
            "value": "1234"
        }
    ],
    "parallelDo": "",
    "events": {},
    "changeFloor": {},
    "afterBattle": {},
    "afterGetItem": {},
    "afterOpenDoor": {},
    "cannotMove": {},
    "bgmap": [

],
    "fgmap": [

],
    "width": 13,
    "height": 13,
    "autoEvent": {},
    "beforeBattle": {},
    "cannotMoveIn": {}
}