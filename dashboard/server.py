#!/usr/bin/env python3
"""Backend API optimizado - Trazabilidad Machine_db"""
from fastapi import FastAPI, Query
from fastapi.responses import FileResponse
import pymssql, time

app = FastAPI(title="Trazabilidad Machine_db API")
DB = {"server":"172.24.217.240","user":"Kepware","password":"Kepware1",
      "database":"Machine_db","login_timeout":5,"timeout":10}

B_COLS = [
    ("TIME","TIME"),("[USER]","BalUser"),("[MOTOR CODE]","MotorCode"),
    # FAN CODE solo existe en BAL15-18, se agrega condicionalmente después
    ("[FINAL STATUS]","FinalStatus"),("VOLTAGE","VOLTAGE"),("[CURRENT]","BalCurrent"),("SPEED","SPEED"),
    ("STATIC","STATIC"),("[STATIC ANGLE]","StaticAngle"),("COUPLE","COUPLE"),
    ("[COUPLE ANGLE]","CoupleAngle"),("UNBALANCE","UNBALANCE"),("[PLANE 1]","Plane1"),
    ("[UNBALANCE PLANE 2]","UnbalPlan2"),("[PLANE 2]","Plane2"),("[BALANCING SPEED]","BalancingSpeed"),
    ("[LEFT BLADE]","LeftBlade"),("[LEFT RADIUS]","LeftRadius"),("[LEFT CLIP]","LeftClip"),
    ("[RIGHT BLADE]","RightBlade"),("[RIGHT RADIUS]","RightRadius"),("[RIGHT CLIP]","RightClip"),
    ("[CYCLE TIME]","CycleTime")
]

# Tablas que tienen columna FAN CODE
TABLES_WITH_FAN = {15,16,17,18}
B_SELECT = ", ".join([f"{s} AS {a}" for s,a in B_COLS])

CELL_MAP = {11:"A",12:"A",15:"B",16:"B",17:"C",18:"C"}
CELL_MACHINES = {"A":[11,12],"B":[15,16],"C":[17,18]}

def getc():
    return pymssql.connect(**DB).cursor(as_dict=True)

@app.get("/api/trazabilidad")
async def trazabilidad(
    cells:str="B", statuses:str="PASS,FAIL,REJECT",
    filterType:str=None, filterValue:str=None,
    page:int=1, pageSize:int=25
):
    """Paginación server-side con UNION ALL - una sola consulta SQL."""
    cl = [c.upper() for c in cells.split(",") if c]
    sl = [s for s in statuses.split(",") if s]
    tables = [f"dbo.BigDataBalancer{m:02d}" for c in cl for m in CELL_MACHINES.get(c,[])]
    if not tables:
        return {"data":[],"total":0,"page":page,"pageSize":pageSize}

    # WHERE común
    w = []
    if sl:
        cond = " OR ".join([f"UPPER([FINAL STATUS]) LIKE '%{s}%'" for s in sl])
        w.append(f"({cond})")
    if filterType and filterValue:
        if filterType == "Motor":
            w.append(f"[MOTOR CODE] LIKE '{filterValue}%'")
        else:
            w.append(f"TIME LIKE '{filterValue}%'")
    wh = (" WHERE " + " AND ".join(w)) if w else ""

    # UNION ALL en una sola consulta con FAN CODE condicional
    limit = page * pageSize
    parts = []
    for tbl in tables:
        mn = int(tbl.replace("dbo.BigDataBalancer", ""))
        cell = CELL_MAP.get(mn, "?")
        # FAN CODE solo existe en tablas 15-18
        fan_col = "[FAN CODE] AS FanCode" if mn in TABLES_WITH_FAN else "NULL AS FanCode"
        cols_with_fan = B_SELECT.replace("[FAN CODE] AS FanCode", fan_col)
        parts.append(f"SELECT TOP {limit} '{cell}' AS CELL, {cols_with_fan} FROM {tbl}{wh}")
    if not parts:
        return {"data":[],"total":0,"page":page,"pageSize":pageSize}
    sql = f"SELECT TOP {limit} * FROM ({' UNION ALL '.join(parts)}) AS combined ORDER BY TIME DESC"

    cur = getc()
    t0 = time.time()
    try:
        cur.execute(sql)
        all_data = cur.fetchall()
    except Exception as e:
        print(f"Query error: {e}")
        all_data = []
    cur.connection.close()

    total = len(all_data)
    start = (page - 1) * pageSize
    data = all_data[start:start + pageSize]
    print(f"trazabilidad: {total} total, {len(data)} returned, {time.time()-t0:.2f}s")
    return {"data": data, "total": total, "page": page, "pageSize": pageSize, "sql": sql}

@app.get("/api/trazabilidad/search")
async def search(code:str=Query(...), type:str="motor", limit:int=50):
    t0 = time.time(); cur = getc(); all_data = []
    if type == "barcode":
        for tbl in ["dbo.G3Datas_v2", "dbo.G4Datas"]:
            try:
                cur.execute(f"SELECT TOP {limit//2} * FROM {tbl} WHERE BarCode LIKE '%{code}%' OR PrintLabel LIKE '%{code}%' ORDER BY fecha_hora DESC")
                all_data.extend(cur.fetchall())
            except Exception as e:
                print(f"Search {tbl}: {e}")
    else:
        col = "[MOTOR CODE]" if type == "motor" else "[FAN CODE]"
        parts = []
        for m in range(11, 19):
            tbl = f"dbo.BigDataBalancer{m:02d}"
            cell = CELL_MAP.get(m, "?")
            fan_col = "[FAN CODE] AS FanCode" if m in TABLES_WITH_FAN else "NULL AS FanCode"
            cols = B_SELECT.replace("[FAN CODE] AS FanCode", fan_col)
            parts.append(f"SELECT TOP {limit//8} '{cell}' AS CELL, {cols} FROM {tbl} WHERE {col} LIKE '%{code}%'")
        if parts:
            sql = f"SELECT TOP {limit} * FROM ({' UNION ALL '.join(parts)}) AS combined ORDER BY TIME DESC"
            try:
                cur.execute(sql)
                all_data = cur.fetchall()
            except Exception as e:
                print(f"Search union error: {e}")
    cur.connection.close()
    print(f"Search '{code}' ({type}): {len(all_data)} in {time.time()-t0:.2f}s")
    return {"data": all_data[:limit], "total": len(all_data), "sql": sql if type != "barcode" else ""}

@app.get("/api/trazabilidad/detail")
async def detail(motorCode:str=Query(...)):
    t0 = time.time(); cur = getc()
    r = {"motorCode":motorCode,"motorInfo":None,"balances":[],"electricTests":[]}
    # Part number
    pn = ""; idx = motorCode.find("5YY")
    if idx >= 0: pn = motorCode[idx:idx+15]
    if pn:
        try:
            cur.execute("SELECT TOP 1 Maquina,ID,Molde,Nombre,Part_Number,Cycle_Rate,Resinas FROM dbo.MachinePartDetails WHERE Part_Number LIKE '%'||%s||'%'", (pn[:12],))
            row = cur.fetchone()
            if row:
                r["motorInfo"]={"Máquina":row[0],"ID Línea":row[1],"Molde":row[2],"Nombre Pieza":row[3],"Part Number":row[4],"Cycle Rate":str(row[5]) if row[5] else "--","Resina":row[6] or "--"}
        except: pass
    # Balanceos con UNION ALL y FAN CODE condicional
    parts = []
    for m in range(11, 19):
        tbl = f"dbo.BigDataBalancer{m:02d}"
        cell = CELL_MAP.get(m, "?")
        fan_col = "[FAN CODE] AS FanCode" if m in TABLES_WITH_FAN else "NULL AS FanCode"
        cols = B_SELECT.replace("[FAN CODE] AS FanCode", fan_col)
        parts.append(f"SELECT TOP 5 '{cell}' AS CELL, {cols} FROM {tbl} WHERE MotorCode LIKE '%{motorCode}%'")
    if parts:
        try:
            cur.execute(f"SELECT TOP 20 * FROM ({' UNION ALL '.join(parts)}) AS combined ORDER BY TIME DESC")
            r["balances"] = cur.fetchall()
        except: pass
    # Pruebas eléctricas
    try:
        cur.execute("SELECT TOP 10 * FROM dbo.G3Datas_v2 WHERE PrintLabel LIKE '%'||%s||'%' OR BarCode LIKE '%'||%s||'%' ORDER BY fecha_hora DESC", (motorCode, motorCode))
        r["electricTests"] = cur.fetchall() or []
    except: pass
    if len(r["electricTests"]) < 5:
        try:
            cur.execute("SELECT TOP 10 * FROM dbo.G4Datas WHERE PrintLabel LIKE '%'||%s||'%' OR BarCode LIKE '%'||%s||'%' ORDER BY fecha_hora DESC", (motorCode, motorCode))
            r["electricTests"].extend(cur.fetchall() or [])
        except: pass
    cur.connection.close()
    print(f"Detail '{motorCode}': {len(r['balances'])} balances, {len(r['electricTests'])} tests in {time.time()-t0:.2f}s")
    return r

@app.get("/")
async def root():
    return FileResponse("trazabilidad.html")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, log_level="info")
