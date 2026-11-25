import psycopg2
import time
import io

RENDER_URL = "postgresql://ble_sense1_wmy5_user:iH8cdQWH3GP2zvVO6TI8vuGln2nC4MJ0@dpg-dbg6j6a9lscs7396ms0g-a.ohio-postgres.render.com/ble_sense1_wmy5"
LOCAL_URL = "postgresql://postgres:admin123@localhost:5432/blesense_local"

def sync_data():
    print("1/4 Connecting to Render (Source) and Local (Target)...")
    src_conn = psycopg2.connect(RENDER_URL)
    tgt_conn = psycopg2.connect(LOCAL_URL)
    src_cur = src_conn.cursor()
    tgt_cur = tgt_conn.cursor()

    # Ordered by foreign key dependencies
    tables = [
        "alembic_version",
        "users",
        "tag_registry",
        "raw_packets",
        "datalogger_headers",
        "datalogger_points",
        "sensor_packets"
    ]

    print("2/4 Disabling triggers/foreign keys temporarily for clean insertion...")
    tgt_cur.execute("SET session_replication_role = 'replica';")
    tgt_conn.commit()

    print("3/4 Streaming and copying data table by table...")
    for table in tables:
        start_t = time.time()
        # Truncate target table first to avoid duplicate primary key collisions
        tgt_cur.execute(f"TRUNCATE TABLE {table} CASCADE;")
        tgt_conn.commit()

        # Stream directly using PostgreSQL COPY
        buf = io.StringIO()
        src_cur.copy_expert(f"COPY {table} TO STDOUT WITH (FORMAT CSV, HEADER FALSE);", buf)
        buf.seek(0)
        tgt_cur.copy_expert(f"COPY {table} FROM STDIN WITH (FORMAT CSV, HEADER FALSE);", buf)
        tgt_conn.commit()

        src_cur.execute(f"SELECT COUNT(*) FROM {table};")
        src_count = src_cur.fetchone()[0]

        tgt_cur.execute(f"SELECT COUNT(*) FROM {table};")
        tgt_count = tgt_cur.fetchone()[0]

        duration = time.time() - start_t
        print(f"  -> {table}: Copied {tgt_count}/{src_count} rows in {duration:.2f}s")

    print("4/4 Re-enabling triggers and resetting sequence counters...")
    tgt_cur.execute("SET session_replication_role = 'origin';")
    tgt_conn.commit()

    # Reset sequences for auto-increment columns
    tables_with_id = ["users", "tag_registry", "raw_packets", "datalogger_headers", "datalogger_points", "sensor_packets"]
    for table in tables_with_id:
        try:
            tgt_cur.execute(f"""
                SELECT setval(
                    pg_get_serial_sequence('{table}', 'id'),
                    COALESCE((SELECT MAX(id) FROM {table}), 1)
                );
            """)
            tgt_conn.commit()
        except Exception as e:
            tgt_conn.rollback()

    src_conn.close()
    tgt_conn.close()
    print("\n✅ SYNC COMPLETE! All data from Render has been successfully cloned into your local database.")

if __name__ == "__main__":
    sync_data()
