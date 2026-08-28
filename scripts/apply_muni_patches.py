from pathlib import Path

ROOT = Path(r"C:\Users\Jasmine Basarte\BawatTalaApp")

SCHEMA_SQL = """
  await pool.query(`
    create table if not exists public.student_muni_wardrobes (
      id uuid primary key default gen_random_uuid(),
      student_number text not null unique,
      owned_items jsonb not null default '{}'::jsonb,
      loadout jsonb not null default '{}'::jsonb,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );
  `);

  await pool.query(`
    create table if not exists public.student_muni_purchases (
      id uuid primary key default gen_random_uuid(),
      student_number text not null,
      section_id text not null,
      item_id text not null,
      price_paid integer not null default 0,
      created_at timestamptz not null default now(),
      constraint student_muni_purchases_unique unique (student_number, section_id, item_id),
      constraint student_muni_purchases_price_check check (price_paid >= 0)
    );
  `);

  await pool.query(`
    create index if not exists student_muni_purchases_student_idx
      on public.student_muni_purchases (student_number, created_at desc);
  `);
"""

API_HELPERS = r'''
export type MuniLoadoutRecord = {
  background: string | null;
  eye: string | null;
  head: string | null;
  outfit: string | null;
};

export type MuniOwnedItemsRecord = {
  background: string[];
  eye: string[];
  head: string[];
  outfit: string[];
};

export async function fetchMuniWardrobe(
  studentNumber: string,
): Promise<
  ApiResult & {
    loadout?: MuniLoadoutRecord;
    ownedItems?: MuniOwnedItemsRecord;
    totalTala?: number;
  }
> {
  const params = new URLSearchParams({ studentNumber });
  const { response, data } = await get(`/api/muni/wardrobe?${params.toString()}`);
  return {
    ok: response.ok,
    message: data?.message,
    loadout: data?.loadout,
    ownedItems: data?.ownedItems,
    totalTala: typeof data?.totalTala === "number" ? data.totalTala : undefined,
  };
}

export async function purchaseMuniWardrobeItem(payload: {
  itemId: string;
  sectionId: string;
  studentNumber: string;
}): Promise<
  ApiResult & {
    loadout?: MuniLoadoutRecord;
    ownedItems?: MuniOwnedItemsRecord;
    totalTala?: number;
  }
> {
  const { response, data } = await post("/api/muni/purchase", payload);
  return {
    ok: response.ok,
    message: data?.message,
    loadout: data?.loadout,
    ownedItems: data?.ownedItems,
    totalTala: typeof data?.totalTala === "number" ? data.totalTala : undefined,
  };
}

export async function saveMuniLoadoutRemote(payload: {
  loadout: MuniLoadoutRecord;
  studentNumber: string;
}): Promise<
  ApiResult & {
    loadout?: MuniLoadoutRecord;
    ownedItems?: MuniOwnedItemsRecord;
    totalTala?: number;
  }
> {
  const { response, data } = await patch("/api/muni/loadout", payload);
  return {
    ok: response.ok,
    message: data?.message,
    loadout: data?.loadout,
    ownedItems: data?.ownedItems,
    totalTala: typeof data?.totalTala === "number" ? data.totalTala : undefined,
  };
}

'''


def main():
    db = ROOT / "backend" / "src" / "config" / "db.js"
    db_text = db.read_text(encoding="utf-8")
    if "student_muni_wardrobes" not in db_text:
        marker = "    create table if not exists public.student_tala_wallets ("
        idx = db_text.find(marker)
        if idx < 0:
            raise SystemExit("tala wallets table not found")
        end = db_text.find("  `);\n", idx)
        if end < 0:
            raise SystemExit("end of tala wallets query not found")
        insert_at = end + len("  `);\n")
        db.write_text(db_text[:insert_at] + "\n" + SCHEMA_SQL + db_text[insert_at:], encoding="utf-8")
        print("patched db.js schema")
    else:
        print("db.js already has wardrobe tables")

    app = ROOT / "backend" / "src" / "app.js"
    app_text = app.read_text(encoding="utf-8")
    if "muni.routes" not in app_text:
        app_text = app_text.replace(
            'const moodRoutes = require("./api/mood.routes");\n',
            'const moodRoutes = require("./api/mood.routes");\nconst muniRoutes = require("./api/muni.routes");\n',
            1,
        )
        app_text = app_text.replace(
            'app.use("/api/moods", moodRoutes);\n',
            'app.use("/api/moods", moodRoutes);\napp.use("/api/muni", muniRoutes);\n',
            1,
        )
        app.write_text(app_text, encoding="utf-8")
        print("patched app.js")
    else:
        print("app.js already mounts muni routes")

    api = ROOT / "mobile-app" / "lib" / "backend-api.ts"
    api_text = api.read_text(encoding="utf-8")
    if "fetchMuniWardrobe" not in api_text:
        needle = "export async function fetchCheckInStatus("
        idx = api_text.find(needle)
        if idx < 0:
            raise SystemExit("fetchCheckInStatus not found")
        api.write_text(api_text[:idx] + API_HELPERS + api_text[idx:], encoding="utf-8")
        print("patched backend-api.ts")
    else:
        print("backend-api.ts already has muni helpers")

    auth = ROOT / "mobile-app" / "lib" / "auth-session.tsx"
    auth_text = auth.read_text(encoding="utf-8")
    if "resetMuniWardrobe" not in auth_text:
        auth_text = auth_text.replace(
            'import { setApiAuthToken } from "./backend-api";\n',
            'import { setApiAuthToken } from "./backend-api";\nimport { hydrateMuniWardrobe, resetMuniWardrobe } from "./muni-wardrobe";\n',
            1,
        )
        auth_text = auth_text.replace(
            "      clearUser: () => {\n        setApiAuthToken(null);\n        setUser(null);\n        void AsyncStorage.removeItem(AUTH_SESSION_STORAGE_KEY);\n      },",
            "      clearUser: () => {\n        setApiAuthToken(null);\n        resetMuniWardrobe();\n        setUser(null);\n        void AsyncStorage.removeItem(AUTH_SESSION_STORAGE_KEY);\n      },",
            1,
        )
        auth_text = auth_text.replace(
            "        if (nextUser) {\n          void AsyncStorage.setItem(AUTH_SESSION_STORAGE_KEY, JSON.stringify(nextUser));\n          return;\n        }",
            "        if (nextUser) {\n          void AsyncStorage.setItem(AUTH_SESSION_STORAGE_KEY, JSON.stringify(nextUser));\n          void hydrateMuniWardrobe(nextUser.studentNumber);\n          return;\n        }\n        resetMuniWardrobe();",
            1,
        )
        auth.write_text(auth_text, encoding="utf-8")
        print("patched auth-session.tsx")
    else:
        print("auth-session.tsx already wired")

    print("done")


if __name__ == "__main__":
    main()
