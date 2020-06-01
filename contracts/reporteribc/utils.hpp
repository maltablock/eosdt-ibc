#pragma once

std::vector<std::string> split(const std::string& str, const std::string& delim) {
    std::vector<std::string> tokens;
    size_t prev = 0, pos = 0;

    do
    {
        pos = str.find(delim, prev);
        if (pos == std::string::npos) pos = str.length();
        std::string token = str.substr(prev, pos - prev);
        tokens.push_back(token);
        prev = pos + delim.length();
    }
    while (pos < str.length() && prev < str.length());
    return tokens;
}

void push_first_free(std::vector<eosio::name>& vec, eosio::name val) {
    for(auto it = vec.begin(); it != vec.end(); it++) {
        if(it->value == 0) {
            *it = val;
            return;
        }
    }
    eosio::check(false, "push_first_free: iterated past vector");
}

uint32_t count_non_empty(const std::vector<eosio::name>& vec) {
    uint32_t count = 0;
    for(auto it : vec) {
        if(it.value == 0) {
            break;
        }
        count++;
    }
    return count;
}
