document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
  <h2>도시센터</h2>
  <p>
    도시센터는 마을의 본부 역할을 하며, 다른 건물의 최대 업그레이드 가능 레벨과 개방 시기를 결정합니다.<br>
    도시센터 레벨이 올라갈수록 연 생산량과 전투력이 증가합니다.<br>
    아래에 기재된 건설 시간은 기본 시간입니다. 버프, 연구, 살로의 스킬 등으로 인한 시간 단축 효과는 포함되어 있지 않습니다.<br>
    대부분의 플레이어는 이보다 짧은 건설 시간을 경험할 수 있습니다.
  </p>


  <table border="1" cellpadding="6" cellspacing="0">
    <thead>
      <tr>
        <th>레벨</th>
        <th>건설 시간</th>
        <th>빵</th>
        <th>나무</th>
        <th>석재</th>
        <th>철</th>
        <th>전투력</th>
      </tr>
    </thead>
    <tbody>
      <tr><td>1</td><td>–</td><td>–</td><td>–</td><td>–</td><td>–</td><td>–</td><td>2000</td><td>–</td></tr>
<tr><td>2</td><td>벌목장 Lv.1</td><td>–</td><td>180</td><td>–</td><td>–</td><td>6s</td><td>3800</td><td>–</td></tr>
<tr><td>3</td><td>민가 1 Lv.2</td><td>–</td><td>805</td><td>–</td><td>–</td><td>1m</td><td>6500</td><td>–</td></tr>
<tr><td>4</td><td>석재공장 Lv.3</td><td>–</td><td>1.8k</td><td>360</td><td>–</td><td>3m</td><td>10100</td><td>20</td></tr>
<tr><td>5</td><td>영웅의 홀, 민가 3 Lv.3</td><td>–</td><td>7.6k</td><td>1.5k</td><td>–</td><td>10m</td><td>15500</td><td>–</td></tr>
<tr><td>6</td><td>제철공장 Lv.5</td><td>–</td><td>19k</td><td>3.8k</td><td>960</td><td>30m</td><td>23600</td><td>–</td></tr>
<tr><td>7</td><td>방앗간 Lv.6</td><td>–</td><td>69k</td><td>13k</td><td>3.4k</td><td>1h</td><td>35300</td><td>–</td></tr>
<tr><td>8</td><td>보병대 Lv.7</td><td>–</td><td>120k</td><td>25k</td><td>6.3k</td><td>2h 30m</td><td>47000</td><td>–</td></tr>
<tr><td>9</td><td>대사관 Lv.8, 야전병원 Lv.1</td><td>–</td><td>260k</td><td>52k</td><td>13k</td><td>4h 30m</td><td>58700</td><td>–</td></tr>
<tr><td>10</td><td>궁병대 Lv.9, 아카데미</td><td>–</td><td>460k</td><td>92k</td><td>23k</td><td>6h</td><td>75700</td><td>22</td></tr>
<tr><td>11</td><td>대사관 Lv.10, 기병대 Lv.10</td><td>1.3M</td><td>1.3M</td><td>20k</td><td>65k</td><td>7h 30m</td><td>92700</td><td>25</td></tr>
<tr><td>12</td><td>대사관 Lv.11, 지휘부 Lv.1</td><td>1.6M</td><td>1.6M</td><td>330k</td><td>84k</td><td>9h</td><td>109700</td><td>28</td></tr>
<tr><td>13</td><td>대사관 Lv.12, 보병대 Lv.12</td><td>2.3M</td><td>2.3M</td><td>470k</td><td>110k</td><td>11h</td><td>138400</td><td>31</td></tr>
<tr><td>14</td><td>대사관 Lv.13, 궁병대 Lv.13</td><td>3.1M</td><td>3.1M</td><td>630k</td><td>150k</td><td>14h</td><td>167100</td><td>34</td></tr>
<tr><td>15</td><td>대사관 Lv.14, 기병대 Lv.14</td><td>4.6M</td><td>4.6M</td><td>930k</td><td>230k</td><td>18h</td><td>195800</td><td>37</td></tr>
<tr><td>16</td><td>대사관 Lv.15, 아카데미 Lv.15</td><td>5.9M</td><td>5.9M</td><td>1.1M</td><td>290k</td><td>1d 6h 28m</td><td>236200</td><td>40</td></tr>
<tr><td>17</td><td>대사관 Lv.16, 보병대 Lv.16</td><td>9.3M</td><td>9.3M</td><td>1.8M</td><td>480k</td><td>1d 12h 34m</td><td>276600</td><td>43</td></tr>
<tr><td>18</td><td>대사관 Lv.17, 궁병대 Lv.17</td><td>12M</td><td>12M</td><td>2.5M</td><td>620k</td><td>1d 19h 53m</td><td>317000</td><td>46</td></tr>
<tr><td>19</td><td>대사관 Lv.18, 기병대 Lv.18</td><td>15M</td><td>15M</td><td>3.1M</td><td>780k</td><td>2d 17h 50m</td><td>374400</td><td>49</td></tr>
<tr><td>20</td><td>대사관 Lv.19, 아카데미 Lv.19</td><td>21M</td><td>21M</td><td>4.3M</td><td>1M</td><td>3d 10h 18m</td><td>431800</td><td>54</td></tr>
<tr><td>21</td><td>대사관 Lv.20, 보병대 Lv.20</td><td>27M</td><td>27M</td><td>5.4M</td><td>1.3M</td><td>4d 10h 59m</td><td>489200</td><td>59</td></tr>
<tr><td>22</td><td>대사관 Lv.21, 궁병대 Lv.21</td><td>36M</td><td>36M</td><td>7.2M</td><td>1.8M</td><td>6d 16h 29m</td><td>575300</td><td>64</td></tr>
<tr><td>23</td><td>대사관 Lv.22, 기병대 Lv.22</td><td>44M</td><td>44M</td><td>8.9M</td><td>2.2M</td><td>9d 8h 40m</td><td>661400</td><td>69</td></tr>
<tr><td>24</td><td>대사관 Lv.23, 아카데미 Lv.23</td><td>60M</td><td>60M</td><td>12M</td><td>3M</td><td>13d 2h 33m</td><td>747500</td><td>74</td></tr>
<tr><td>25</td><td>대사관 Lv.24, 보병대 Lv.24</td><td>81M</td><td>81M</td><td>16M</td><td>4M</td><td>18d 8h 22m</td><td>833600</td><td>79</td></tr>
<tr><td>26</td><td>대사관 Lv.25, 궁병대 Lv.25</td><td>100M</td><td>100M</td><td>21M</td><td>5.2M</td><td>21d 2h 26m</td><td>960100</td><td>80 (최대)</td></tr>
<tr><td>27</td><td>대사관 Lv.26, 기병대 Lv.26</td><td>140M</td><td>140M</td><td>24M</td><td>7.4M</td><td>25d 7h 43m</td><td>1086600</td><td>–</td></tr>
<tr><td>28</td><td>대사관 Lv.27, 아카데미 Lv.27</td><td>190M</td><td>190M</td><td>39M</td><td>9.9M</td><td>29d 2h 52m</td><td>1213100</td><td>–</td></tr>
<tr><td>29</td><td>대사관 Lv.28, 보병대 Lv.28</td><td>240M</td><td>240M</td><td>49M</td><td>12M</td><td>33d 11h 42m</td><td>1339600</td><td>–</td></tr>
<tr><td>30</td><td>대사관 Lv.29, 궁병대 Lv.29</td><td>300M</td><td>300M</td><td>60M</td><td>15M</td><td>40d 4h 27m</td><td>1523500</td><td>–</td></tr>

    </tbody>
  </table>
`;
