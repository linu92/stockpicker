import codecs
import re
import traceback

try:
    with open('app.py', 'rb') as f:
        raw_data = f.read()

    try:
        content = raw_data.decode('utf-8')
    except:
        content = raw_data.decode('cp949', errors='replace')

    old_ui_regex = r"        if df_news\.empty:[\r\n\s]+st\.warning\(\"아직 수집된 기사가 없습니다\.[^\"]+\"\)[\r\n\s]+else:[\r\n\s]+for idx, row in df_news\.iterrows\(\):[\r\n\s]+label = f\"\{row\['title'\]\}\\n\(\{row\['source'\]\} \| \{row\['published_date'\]\}\)\"[\r\n\s]+if st\.button\(label, key=f\"btn_\{idx\}\", use_container_width=True\):[\r\n\s]+st\.session_state\['selected_article_url'\] = row\['url'\]"

    new_ui = '''        # 유사 기사 묶어보기 토글
        group_similar = st.checkbox("🔗 유사 기사 묶어보기 (비슷한 제목의 기사들을 하나로 접어서 표시합니다)", value=True)
        st.markdown("---")
        
        if df_news.empty:
            st.warning("아직 수집된 기사가 없습니다. 좌측 사이드바에서 기간을 설정한 후 '최신 뉴스 가져오기' 버튼을 눌러주세요.")
        else:
            if group_similar:
                import difflib
                clusters = []
                for idx, row in df_news.iterrows():
                    title = row['title']
                    found = False
                    for cluster in clusters:
                        sim = difflib.SequenceMatcher(None, title, cluster[0]['title']).ratio()
                        if sim > 0.55:  # 55% 이상 유사하면 같은 기사로 취급
                            cluster.append(row)
                            found = True
                            break
                    if not found:
                        clusters.append([row])
                
                for i, cluster in enumerate(clusters):
                    main_row = cluster[0]
                    if len(cluster) > 1:
                        label = f"🔥 {main_row['title']} (외 비슷한 기사 {len(cluster)-1}건)\\n({main_row['source']} 등 | {main_row['published_date']})"
                    else:
                        label = f"{main_row['title']}\\n({main_row['source']} | {main_row['published_date']})"
                        
                    if st.button(label, key=f"btn_group_{i}_{st.session_state['news_page']}", use_container_width=True):
                        st.session_state['selected_article_url'] = main_row['url']
            else:
                for idx, row in df_news.iterrows():
                    label = f"{row['title']}\\n({row['source']} | {row['published_date']})"
                    if st.button(label, key=f"btn_{idx}_{st.session_state['news_page']}", use_container_width=True):
                        st.session_state['selected_article_url'] = row['url']'''

    if re.search(old_ui_regex, content):
        content = re.sub(old_ui_regex, new_ui, content)
        print("Grouping UI replaced")
    else:
        print("Could not find regex match.")

    with open('app.py', 'w', encoding='utf-8') as f:
        f.write(content)

except Exception as e:
    traceback.print_exc()

