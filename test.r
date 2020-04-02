#!/usr/bin/env Rscript
wilcox.test(ms ~ scenario, read.csv("out.csv"), conf.int=T)
