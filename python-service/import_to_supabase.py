"""
Import merged_data.csv → Supabase rag_properties table.
Run once (or whenever CSV data changes):

    python import_to_supabase.py --csv ../bot_reccomend/merged_data.csv
    python import_to_supabase.py --csv ../bot_reccomend/merged_data.csv --batch 500
"""

import argparse
import json
import os
import sys
from pathlib import Path

import numpy as np
import pandas as pd
from dotenv import load_dotenv
from supabase import create_client

load_dotenv()

AMENITY_COLS = [
    "Elevator", "Parking", "Security", "CCTV", "Pool",
    "Sauna", "Gym", "Garden", "Playground", "Shop", "Restaurant", "Wifi",
]


def _s(x) -> str:
    if x is None or (isinstance(x, float) and pd.isna(x)):
        return ""
    return " ".join(str(x).split()).strip()


def _coalesce_str(df: pd.DataFrame, *cols: str) -> pd.Series:
    result = pd.Series("", index=df.index, dtype=str)
    for col in reversed(cols):
        if col not in df.columns:
            continue
        v = df[col].fillna("").astype(str).str.strip()
        v = v.where(~v.str.lower().isin(["", "nan", "none"]), "")
        result = v.where(v != "", result)
    return result


def _coalesce_num(df: pd.DataFrame, *cols: str) -> pd.Series:
    result = pd.Series(np.nan, index=df.index, dtype=float)
    for col in reversed(cols):
        if col not in df.columns:
            continue
        v = pd.to_numeric(df[col].astype(str).str.replace(",", "", regex=False), errors="coerce")
        result = v.where(v.notna(), result)
    return result


def csv_to_rows(csv_path: str) -> list[dict]:
    df = pd.read_csv(csv_path, encoding="utf-8-sig", low_memory=False)

    name      = _coalesce_str(df, "name_th", "name_x", "name_y")
    ptype_raw = _coalesce_str(df, "propertytype_name_en")
    ptype     = ptype_raw.where(ptype_raw != "", "Condo")
    province  = _coalesce_str(df, "province_name_en")
    district  = _coalesce_str(df, "district_name_th", "district_y")
    nbh       = _coalesce_str(df, "neighborhood_name_th", "subdistrict_name_th")
    developer = _coalesce_str(df, "developer_name_th")
    url       = _coalesce_str(df, "url_project")

    price_min    = _coalesce_num(df, "price_min").fillna(0).astype(int)
    price_sqm    = _coalesce_num(df, "price_sqm_x", "price_sqm_y").fillna(0).astype(int)
    year_built   = _coalesce_num(df, "year_built_x", "year_built_y").fillna(0).astype(int)
    nbr_floors   = _coalesce_num(df, "nbr_floors_x", "nbr_floors_y").fillna(0).astype(int)
    rental_yield = _coalesce_num(df, "rental_yield")

    lat_prop = _coalesce_num(df, "latitude_prop")
    lon_prop = _coalesce_num(df, "longitude_prop")
    lat_cent = _coalesce_num(df, "latitude")
    lon_cent = _coalesce_num(df, "longitude")
    has_prop = lat_prop.notna() & lon_prop.notna()
    lat      = lat_prop.where(has_prop, lat_cent)
    lon      = lon_prop.where(has_prop, lon_cent)
    coord_acc = has_prop

    trans_raw = df.get("transportation", pd.Series("", index=df.index))
    trans_raw = trans_raw.fillna("").astype(str).str.lower()
    transit   = pd.Series("", index=df.index, dtype=str)
    transit   = transit.where(~trans_raw.str.contains("mrt", na=False), "MRT")
    transit   = transit.where(~trans_raw.str.contains("bts", na=False), "BTS")

    amenity_cols_present = [c for c in AMENITY_COLS if c in df.columns]
    amenity_matrix = (
        df[amenity_cols_present].apply(pd.to_numeric, errors="coerce").fillna(0).astype(int) == 1
    )

    rows = []
    for i in df.index:
        amenities  = [c for c in amenity_cols_present if amenity_matrix.at[i, c]]
        amenity_th = " ".join(amenities) if amenities else "ไม่ระบุ"
        amenity_en = ", ".join(amenities) if amenities else "none listed"

        nm = name.at[i]; pt = ptype.at[i]; pr = province.at[i]; di = district.at[i]
        nb = nbh.at[i];  dv = developer.at[i]
        pm = int(price_min.at[i]); ps = int(price_sqm.at[i])
        yb = int(year_built.at[i]); nf = int(nbr_floors.at[i])
        ry = rental_yield.at[i] if pd.notna(rental_yield.at[i]) else None
        tr = transit.at[i]
        la = lat.at[i] if pd.notna(lat.at[i]) else None
        lo = lon.at[i] if pd.notna(lon.at[i]) else None
        ca = bool(coord_acc.at[i])

        th = (
            f"โครงการ {nm} ประเภท {pt} ย่าน {nb} เขต {di} จังหวัด {pr} "
            f"ราคาเริ่มต้น {pm:,} บาท ราคาเฉลี่ย {ps:,} บาท/ตร.ม. "
            f"สร้างปี {yb} จำนวน {nf} ชั้น สิ่งอำนวยความสะดวก: {amenity_th}"
            + (f" ใกล้รถไฟฟ้า {tr}" if tr else "")
            + (f" ผลตอบแทนเช่า {ry}%" if ry else "")
            + (f" โดย {dv}" if dv else "")
        )
        en = (
            f"{pt} project {nm} in {nb}, {di}, {pr}, "
            f"from {pm:,} THB, avg {ps:,} THB/sqm, built {yb}, {nf} floors, "
            f"amenities: {amenity_en}"
            + (f" near {tr}" if tr else "")
            + (f" rental yield {ry}%" if ry else "")
            + (f" by {dv}" if dv else "")
        )

        rows.append({
            "id":            f"MD-{i}",
            "name":          nm,
            "property_type": pt,
            "province":      pr,
            "district":      di,
            "neighborhood":  nb,
            "developer":     dv,
            "price_thb":     pm or ps or None,
            "price_per_sqm": ps or None,
            "year_built":    yb or None,
            "nbr_floors":    nf or None,
            "rental_yield":  ry,
            "near_transit":  tr or None,
            "amenities":     amenities,
            "url":           url.at[i] or None,
            "latitude":      la,
            "longitude":     lo,
            "coord_accurate": ca,
            "text_content":  f"TH: {th} | EN: {en}",
        })

    return rows


def upload(rows: list[dict], batch_size: int = 500):
    url = os.getenv("SUPABASE_URL") or os.getenv("VITE_SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        sys.exit("ERROR: Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env")

    sb = create_client(url, key)
    total = len(rows)
    print(f"Uploading {total:,} rows to Supabase rag_properties table...")

    for start in range(0, total, batch_size):
        batch = rows[start:start + batch_size]
        sb.table("rag_properties").upsert(batch).execute()
        end = min(start + batch_size, total)
        print(f"  {end:,}/{total:,} rows uploaded")

    print(f"Done. {total:,} rows in rag_properties.")


def main():
    parser = argparse.ArgumentParser(description="Import CSV to Supabase rag_properties")
    parser.add_argument("--csv", default="../bot_reccomend/merged_data.csv", help="Path to merged_data.csv")
    parser.add_argument("--batch", type=int, default=500, help="Batch size for upsert (default 500)")
    args = parser.parse_args()

    csv_path = Path(args.csv)
    if not csv_path.exists():
        sys.exit(f"ERROR: CSV not found at {csv_path.resolve()}")

    print(f"Reading {csv_path.resolve()}...")
    rows = csv_to_rows(str(csv_path))
    print(f"Parsed {len(rows):,} rows")
    upload(rows, batch_size=args.batch)


if __name__ == "__main__":
    main()
