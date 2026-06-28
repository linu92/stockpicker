import codecs
import re
import traceback

try:
    # Read the file
    with open('app.py', 'rb') as f:
        raw_data = f.read()

    # Try detecting decoding
    try:
        content = raw_data.decode('utf-8')
    except:
        content = raw_data.decode('cp949', errors='replace')

    # Fix pagination logic
    old_query_regex = r"    base_query \+= \" ORDER BY published_date DESC, id DESC LIMIT 50\"[\r\n\s]+df_news = pd\.read_sql_query\(base_query, engine, params=query_params\)"

    new_query = '''    # 페이징 처리
    if 'news_page' not in st.session_state:
        st.session_state['news_page'] = 1
        
    page_size = 50
    
    # 전체 개수 구하기
    count_query = "SELECT COUNT(*) FROM news"
    if where_clauses:
        count_query += " WHERE " + " AND ".join(where_clauses)
    total_count_df = pd.read_sql_query(count_query, engine, params=query_params)
    total_count = int(total_count_df.iloc[0, 0])
    total_pages = (total_count + page_size - 1) // page_size if total_count > 0 else 1
    
    # 현재 페이지가 범위를 벗어나면 교정
    if st.session_state['news_page'] > total_pages:
        st.session_state['news_page'] = total_pages
    if st.session_state['news_page'] < 1:
        st.session_state['news_page'] = 1
        
    offset = (st.session_state['news_page'] - 1) * page_size
    base_query += f" ORDER BY published_date DESC, id DESC LIMIT {page_size} OFFSET {offset}"
    
    df_news = pd.read_sql_query(base_query, engine, params=query_params)'''

    # Ensure it only replaces if it matches
    if re.search(old_query_regex, content):
        content = re.sub(old_query_regex, new_query, content)
        print("Query replaced")

    old_ui_regex = r"                if st\.button\(label, key=f\"btn_\{idx\}\", use_container_width=True\):[\r\n\s]+st\.session_state\['selected_article_url'\] = row\['url'\]"

    new_ui = '''                if st.button(label, key=f"btn_{idx}", use_container_width=True):
                    st.session_state['selected_article_url'] = row['url']
            
            # 페이지 컨트롤 (이전/다음 버튼)
            if total_pages > 1:
                st.markdown("---")
                pcol1, pcol2, pcol3 = st.columns([1, 1, 1])
                with pcol1:
                    if st.button("◀ 이전", disabled=(st.session_state['news_page'] <= 1), use_container_width=True):
                        st.session_state['news_page'] -= 1
                        st.rerun()
                with pcol2:
                    st.markdown(f"<div style='text-align: center; padding-top: 10px;'>{st.session_state['news_page']} / {total_pages}</div>", unsafe_allow_html=True)
                with pcol3:
                    if st.button("다음 ▶", disabled=(st.session_state['news_page'] >= total_pages), use_container_width=True):
                        st.session_state['news_page'] += 1
                        st.rerun()'''

    if re.search(old_ui_regex, content):
        content = re.sub(old_ui_regex, new_ui, content)
        print("UI replaced")

    with open('app.py', 'w', encoding='utf-8') as f:
        f.write(content)
    print("Done")
except Exception as e:
    traceback.print_exc()

