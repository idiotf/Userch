const output = []; // 검색한 유저를 저장할 배열
async function func(obj) {
	function send(query, variables) { // graphql로 POST 요청을 보내는 함수
		function getIdeal() {         // 대충 csrf와 xToken을 구하는 함수
			const next_data = document.getElementById("__NEXT_DATA__"); // json 정보가 담긴 스크립트
			const object = JSON.parse(next_data.innerText);             // json을 자바스크립트 객체로 변환
			return {
				csrf: object.props.initialProps.csrfToken,              // csrf
				xToken: object.props.initialState.common.user?.xToken,  // xToken
			};
		}
		const body = JSON.stringify({ query, variables }); // body 작성
		const {csrf, xToken} = getIdeal();                 // csrf, xToken 구하기
		const headers = {                                  // 헤더 작성
			"Content-Type": "application/json",
			"CSRF-Token": csrf,
			"x-token": xToken,
			"x-client-type": "Client"
		};
		const finalObj = {
			body,
			headers,
			method: "POST" // POST 메소드로 요청
		};
		return fetch("/graphql", finalObj);
	}
	async function getFollows(mode, user) { // 유저의 팔로잉, 팔로워 수를 구하는 함수
		const query = `
			query FIND_USERSTATUS_BY_USERNAME($id: String) {
				userstatus(id: $id) {
					status {
						following
						follower
					}
				}
			}
		`;
		const variables = { id: user };
		const res = await send(query, variables);
		const json = await res.json();
		return json.data.userstatus.status[mode];
	}
	async function* getFollow(mode, user, searchQuery, searchAfter, display, beforeSearch = []) { // 한꺼번에 모든 팔로잉, 팔로워를 구하는 것이 막혀서 generator 사용
		display = display || Math.min(await getFollows(mode, user), 10000); // 10000이 넘는 display 값을 사용하면 값이 나오지 않기 때문에 10000 이하로 제한
		const query = `
			query SELECT_${mode.toUpperCase()}S(
				$user: String, 
				$query: String, 
				$pageParam: PageParam, 
				$searchAfter: JSON
			) {
				${mode}s(user: $user, query: $query, pageParam: $pageParam, searchAfter: $searchAfter) {
					searchAfter
					searchTotal
					list {
						id
						${mode == "follower" ? "user" : "follow"} {
							id
							nickname
							profileImage {
								id
								name
								label {
									ko
									en
									ja
									vn
								}
								filename
								imageType
								dimension {
									width
									height
								}
								trimmed {
									filename
									width
									height
								}
							}
						}
					}
				}
			}
		`;
		const variables = {
			user,
			query: searchQuery,
			pageParam: {display},
			searchAfter
		}
		const res = await send(query, variables);
		const json = await res.json();
		const follow = json.data[mode + "s"].list;
		const final = [...beforeSearch, follow];
		yield follow; // 팔로잉 또는 팔로워 
		if(final.length < display) yield* getFollow(mode, user, searchQuery, json.data[mode + "s"].searchAfter, display, final);
	}
	function getUserId() { // 유저의 id 구하기
		const next_data = document.getElementById("__NEXT_DATA__"); // json 정보가 담긴 스크립트
		const object = JSON.parse(next_data.innerText);             // json을 자바스크립트 객체로 변환
		return object.props.initialState.common.user?._id;
	}
	async function searchUser(myid, nickname, output) {
		if(obj.pause) await new Promise(resolve => setInterval(function() { // 일시정지
			if(!obj.pause) resolve();
		}));
		{
			const searchFollowing = getFollow("following", myid, nickname); // 팔로잉 검색
			const searchFollower  = getFollow("follower",  myid, nickname); // 팔로워 검색
			function step(follow) {
				follow.next().then(v => {
					if(v.done) return;
					const set = new Set([ // 중복된 값이 없도록 Set 사용
						...output, ...v.value.map(user => {
							user.follow = user.follow || user.user;
							return JSON.stringify([user.follow.nickname, user.follow.id]);
						})
					]);
					const oldOutputs = output.length;
					output.length = 0;
					[...set].forEach(v => {
						output.push(v);
						obj.speed++;
					});
					obj.speed -= oldOutputs;
					step(follow);
				});
			}
			step(searchFollowing);
			step(searchFollower);
			/*const searchFollow = await Promise.all([searchFollowing, searchFollower]); // 팔로잉 + 팔로워
			const set = new Set([ // 중복된 값이 없도록 Set 사용
				...output, ...searchFollow.flat().map(user => {
					user.follow = user.follow || user.user;
					return JSON.stringify([user.follow.nickname, user.follow.id]);
				})
			]);
			const oldOutputs = output.length;
			output.length = 0;
			[...set].forEach(v => {
				output.push(v);
				obj.speed++;
			});
			obj.speed -= oldOutputs;*/
		}
		{
			const following = getFollow("following", myid); // 전체 팔로잉
			const follower  = getFollow("follower",  myid); // 전체 팔로워
			function step(follow) {
				follow.next().then(v => {
					if(v.done) return;
					v.value.forEach(user => {
						user.follow = user.follow || user.user;
						searchUser(user.follow.id, nickname, output);
					});
					step(follow);
				});
			}
			step(following);
			step(follower);
			/*const follow = await Promise.all([following, follower]); // 팔로잉 + 팔로워
			follow.flat().forEach(user => { // 팔로잉, 팔로워의 팔로잉, 팔로워를 찾기 위해 재귀함수 실행
				user.follow = user.follow || user.user;
				searchUser(user.follow.id, nickname, output);
			});*/
		}
	}
	await searchUser(getUserId(), nickname, output);
}
const search = new URLSearchParams(location.search);
const nickname = decodeURIComponent(search.get("query"));
const obj = {
	pause: false,
	speed: 0,
};
func(obj); // 유저찾기 함수 실행
function createElement(name, className, id, role, text, type) {
	const element = document.createElement(name);
	className && (element.className = className);
	id && (element.id = id, element.name = id);
	role && (element.role = role);
	text && (element.textContent = text);
	type && (element.type = type);
	return element;
}
const div         = createElement("div", "userch");
const message     = createElement("p", "userch-message", null, null, "검색 속도: ");
const searchSpeed = createElement("span");
message.appendChild(searchSpeed);
setInterval(function() {
	if(!document.getElementById("userch-css")) { // 스타일 적용하기
		const stylesheet = document.createElement("style");
		stylesheet.textContent = `
			.userch {
				position: relative;
				width: 1062px;
				margin: 0px auto;
				padding: 82px 0px 130px;
				overflow: hidden;
			}

			@media (max-width: 1199px) {
				.userch {
					width: auto;
					margin: 0px;
					padding: 80px 30px 130px;
				}
			}

			@media (max-width: 767px) {
				.userch {
					padding: 24px 0px 60px;
				}
			}

			.userch-message {
				font-size: 14pt;
			}

			.userch-message + div {
				display: none;
			}
		`;
		stylesheet.id = "userch-css";
		document.head.appendChild(stylesheet);
	}
	document.title = `유저검색 - ${nickname} : 엔트리`;
	const commonSearch = document.getElementById("CommonSearch");
	if(commonSearch && !commonSearch.classList.contains("userch-input")) {
		commonSearch.addEventListener("keypress", function(e) {
			if(e.key == "Enter") {
				search.set("query", this.value);
				location.search = search;
			}
		});
		commonSearch.addEventListener("focus", function() {
			obj.pause = true;
		});
		commonSearch.addEventListener("blur", function() {
			obj.pause = false;
		});
		commonSearch.classList.add("userch-input");
	}
	const tag = document.querySelector(".ex6tgf87");
	if(!tag?.querySelector?.(".userch-message")) tag?.insertAdjacentElement?.("afterbegin", message);
	const result = document.querySelector(".nextInner .ex6tgf88");
	if(!result?.querySelector?.(".userch")) result?.appendChild?.(div);
	div.innerHTML = output.map(v => JSON.parse(v)).map(v => `<a href="/profile/${v[1]}" target="_blank">${v[0]}</a>`).join("<br>");
});
requestAnimationFrame(function frame() {
	searchSpeed.textContent = 1000 * obj.speed / performance.now();
	requestAnimationFrame(frame);
});
